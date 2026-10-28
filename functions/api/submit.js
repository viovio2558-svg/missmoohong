const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const bad = (error, status = 400) => Response.json({ error }, { status });
export async function onRequestPost({ request, env }) {
 let photoKey = null;
 try {
  let p, file = null;
  if ((request.headers.get('content-type') || '').includes('multipart/form-data')) {
   const f = await request.formData(); p = JSON.parse(String(f.get('data') || '{}')); file = f.get('photo');
   if (typeof file === 'string' || !file || !file.size) file = null;
  } else p = await request.json();
  const username = String(p.username || '').trim().slice(0, 100);
  const continent = String(p.continent || ''), countryId = String(p.countryId || '');
  if (!username || !continent || !countryId || p.acceptRules !== true) return bad('กรุณากรอก Username เลือกประเทศ และยอมรับกติกา');
  const country = await env.DB.prepare('SELECT id,continent,flag,name,status FROM countries WHERE id=?').bind(countryId).first();
  if (!country || country.continent !== continent) return bad('ไม่พบประเทศที่เลือก กรุณาโหลดหน้าใหม่');
  const answers = (p.answers && typeof p.answers === 'object') ? { ...p.answers } : {};
  delete answers.photo_url; // only the server may set this
  // Server-side check of required / dropdown questions (browser checks alone can be bypassed).
  const { results: qs = [] } = await env.DB.prepare("SELECT id,label,field_type,required,options_json FROM form_questions WHERE active=1 AND id!='username'").all();
  for (const q of qs) {
   const v = String(answers[q.id] || '').trim();
   if (q.required && !v) return bad('กรุณากรอก: ' + q.label);
   if (v && q.field_type === 'select' && !JSON.parse(q.options_json || '[]').includes(v)) return bad('ตัวเลือกไม่ถูกต้อง: ' + q.label);
  }
  // Rules: max 2 applications per username, and the competition name must differ between them.
  const { results: mine = [] } = await env.DB.prepare('SELECT answers_json FROM applications WHERE lower(username)=lower(?)').bind(username).all();
  if (mine.length >= 2) return bad('Username นี้สมัครครบ 2 ใบแล้ว (สูงสุด 2 ทวีป)');
  const cn = String(answers.comp_name || '').trim().toLowerCase();
  if (cn && mine.some(a => { try { return String(JSON.parse(a.answers_json).comp_name || '').trim().toLowerCase() === cn } catch (e) { return false } })) return bad('หากสมัคร 2 ทวีป ต้องใช้ชื่อจริงที่ไม่ซ้ำกัน');
  // Portrait photo (required only when R2 uploads are configured).
  const photoOn = !!(env.IMAGES && env.R2_PUBLIC_URL);
  if (photoOn) {
   if (!file) return bad('กรุณาอัปโหลดรูป Portrait Photo');
   if (!TYPES[file.type]) return bad('รูปต้องเป็น JPG, PNG หรือ WEBP เท่านั้น');
   if (file.size > 5 * 1024 * 1024) return bad('ไฟล์รูปต้องมีขนาดไม่เกิน 5 MB');
   photoKey = 'portraits/' + crypto.randomUUID() + '.' + TYPES[file.type];
   await env.IMAGES.put(photoKey, await file.arrayBuffer(), { httpMetadata: { contentType: file.type, cacheControl: 'public, max-age=31536000' } });
   answers.photo_url = env.R2_PUBLIC_URL.replace(/\/$/, '') + '/' + photoKey;
  }
  const appId = 'MMH-' + crypto.randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase();
  // D1 batch is transactional: conditional reservation and insert either both commit or both roll back.
  await env.DB.batch([
   env.DB.prepare("UPDATE countries SET status='TAKEN', application_id=?, updated_at=datetime('now') WHERE id=? AND continent=? AND status='AVAILABLE'").bind(appId, countryId, continent),
   env.DB.prepare("INSERT INTO applications (application_id, username, continent, country_id, country_name, prompt1, prompt2, answers_json) SELECT ?, ?, ?, id, name, ?, ?, ? FROM countries WHERE id=? AND status='TAKEN' AND application_id=?").bind(appId, username, continent, String(answers.prompt1 || '').slice(0, 10000), String(answers.prompt2 || '').slice(0, 10000), JSON.stringify(answers).slice(0, 50000), countryId, appId)
  ]);
  const saved = await env.DB.prepare('SELECT application_id FROM applications WHERE application_id=?').bind(appId).first();
  if (!saved) { if (photoKey) await env.IMAGES.delete(photoKey); return bad('ประเทศนี้เพิ่งมีผู้สมัครคนอื่นจองไป กรุณาเลือกประเทศใหม่', 409); }
  return Response.json({ success: true, applicationId: appId, country: `${country.flag} ${country.name}`, username });
 } catch (e) {
  try { if (photoKey) await env.IMAGES.delete(photoKey); } catch (_) {}
  return bad('ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง', 500);
 }
}

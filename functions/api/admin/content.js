function auth(request,env){return !!env.ADMIN_PASSWORD && request.headers.get('x-admin-password')===env.ADMIN_PASSWORD;}
export async function onRequestGet({request,env}){
 if(!auth(request,env)) return Response.json({error:'รหัสผ่านแอดมินไม่ถูกต้อง'},{status:401});
 const [{results:settings=[]},{results:questions=[]}]=await Promise.all([env.DB.prepare('SELECT key,value FROM site_settings').all(),env.DB.prepare('SELECT * FROM form_questions ORDER BY sort_order,id').all()]);
 return Response.json({settings:Object.fromEntries(settings.map(x=>[x.key,x.value])),questions:questions.map(q=>({...q,required:!!q.required,active:!!q.active,options:JSON.parse(q.options_json||'[]')}))});
}
export async function onRequestPost({request,env}){
 if(!auth(request,env)) return Response.json({error:'รหัสผ่านแอดมินไม่ถูกต้อง'},{status:401});
 try { const p=await request.json();
  if(p.action==='saveSettings'){
   const allowed=['eyebrow','title','subtitle','intro','logo_url','hero_url','banner_url','rules_text','photo_guide','prompt1_text','prompt2_text','tiktok_text','openchat_text','photo_example_url','openchat_qr_url']; const stmts=[];
   for(const key of allowed) if(typeof p.settings?.[key]==='string') stmts.push(env.DB.prepare('INSERT INTO site_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key,p.settings[key].slice(0,8000)));
   if(stmts.length) await env.DB.batch(stmts); return Response.json({success:true});
  }
  if(p.action==='saveQuestions'){
   if(!Array.isArray(p.questions)||p.questions.length>40) return Response.json({error:'รายการคำถามไม่ถูกต้อง (สูงสุด 40 ข้อ)'},{status:400});
   if(!p.questions.some(q=>q.id==='username')) return Response.json({error:'ห้ามลบคำถาม Username เพราะจำเป็นต่อการสมัคร'},{status:400});
   const ids=new Set(), stmts=[];
   for(let i=0;i<p.questions.length;i++){const q=p.questions[i]; const id=String(q.id||'q_'+crypto.randomUUID()).slice(0,80); if(ids.has(id)) return Response.json({error:'รหัสคำถามซ้ำกัน'},{status:400}); ids.add(id);
    const label=String(q.label||'').trim().slice(0,180); const type=['text','textarea','email','url','select'].includes(q.field_type)?q.field_type:'textarea'; const opts=Array.isArray(q.options)?q.options.map(x=>String(x).slice(0,100)).slice(0,50):[];
    if(!label) return Response.json({error:'ทุกคำถามต้องมีข้อความคำถาม'} ,{status:400});
    stmts.push(env.DB.prepare('INSERT INTO form_questions(id,label,help_text,placeholder,field_type,required,options_json,sort_order,active) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET label=excluded.label,help_text=excluded.help_text,placeholder=excluded.placeholder,field_type=excluded.field_type,required=excluded.required,options_json=excluded.options_json,sort_order=excluded.sort_order,active=excluded.active').bind(id,label,String(q.help_text||'').slice(0,500),String(q.placeholder||'').slice(0,500),type,q.required?1:0,JSON.stringify(opts),i+1,q.active===false?0:1));
   }
   await env.DB.batch(stmts);
   // Remove omitted questions only if they have not been used as legacy identifiers; answers are stored as JSON.
   const all=await env.DB.prepare('SELECT id FROM form_questions').all(); const remove=all.results.filter(q=>!ids.has(q.id)).map(q=>env.DB.prepare('DELETE FROM form_questions WHERE id=?').bind(q.id)); if(remove.length) await env.DB.batch(remove);
   return Response.json({success:true});
  }
  return Response.json({error:'คำสั่งไม่ถูกต้อง'},{status:400});
 }catch(e){return Response.json({error:'บันทึกไม่สำเร็จ กรุณาตรวจสอบข้อมูล'},{status:400});}
}

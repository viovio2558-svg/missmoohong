function auth(request, env) { return !!env.ADMIN_PASSWORD && request.headers.get('x-admin-password') === env.ADMIN_PASSWORD; }
export async function onRequestPost({ request, env }) {
 if (!auth(request,env)) return Response.json({error:'รหัสผ่านแอดมินไม่ถูกต้อง'}, {status:401});
 const p=await request.json(); const action=String(p.action||'');
 if(action==='status') { if(!['AVAILABLE','CLOSED'].includes(p.status)) return Response.json({error:'สถานะไม่ถูกต้อง'}, {status:400}); const r=await env.DB.prepare("UPDATE countries SET status=?, application_id=NULL, updated_at=datetime('now') WHERE id=? AND status IN ('AVAILABLE','CLOSED')").bind(p.status,p.id).run(); return Response.json({success:!!r.meta.changes}); }
 if(action==='delete') { const r=await env.DB.prepare("DELETE FROM countries WHERE id=? AND status IN ('AVAILABLE','CLOSED')").bind(p.id).run(); return Response.json({success:!!r.meta.changes, error:r.meta.changes?undefined:'ลบไม่ได้: ประเทศอาจมีผู้สมัครแล้ว'}); }
 if(action==='add') { const name=String(p.name||'').trim().slice(0,100), continent=String(p.continent||''), flag=String(p.flag||'').slice(0,12); if(!name || !['Africa','America','Europe','Asia & Oceania'].includes(continent)) return Response.json({error:'กรอกชื่อประเทศและทวีปให้ถูกต้อง'}, {status:400}); const id='custom_'+crypto.randomUUID(); try { await env.DB.prepare("INSERT INTO countries(id,continent,flag,name,status) VALUES(?,?,?,?, 'AVAILABLE')").bind(id,continent,flag,name).run(); return Response.json({success:true,id}); } catch(e) { return Response.json({error:'มีประเทศชื่อนี้อยู่แล้ว หรือข้อมูลไม่ถูกต้อง'}, {status:400}); } }
 return Response.json({error:'คำสั่งไม่ถูกต้อง'}, {status:400});
}

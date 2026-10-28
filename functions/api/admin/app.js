function auth(request, env) { return !!env.ADMIN_PASSWORD && request.headers.get('x-admin-password') === env.ADMIN_PASSWORD; }
export async function onRequestGet({ request, env }) {
 if (!auth(request,env)) return Response.json({error:'รหัสผ่านแอดมินไม่ถูกต้อง'}, {status:401});
 const {results=[]}=await env.DB.prepare('SELECT application_id, submitted_at, username, continent, country_name, prompt1, prompt2, answers_json, status FROM applications ORDER BY submitted_at DESC').all();
 return Response.json({applications:results});
}

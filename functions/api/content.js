export async function onRequestGet({ env }) {
 const [{results: settings=[]},{results: questions=[]}] = await Promise.all([
  env.DB.prepare('SELECT key,value FROM site_settings').all(),
  env.DB.prepare('SELECT id,label,help_text,placeholder,field_type,required,options_json,sort_order,active FROM form_questions WHERE active=1 ORDER BY sort_order,id').all()
 ]);
 const config=Object.fromEntries(settings.map(x=>[x.key,x.value]));
 return Response.json({photoEnabled:!!(env.IMAGES&&env.R2_PUBLIC_URL),settings:config,questions:questions.map(q=>({...q,required:!!q.required,options:JSON.parse(q.options_json||'[]')}))});
}

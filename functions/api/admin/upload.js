function auth(request,env){return !!env.ADMIN_PASSWORD && request.headers.get('x-admin-password')===env.ADMIN_PASSWORD;}
export async function onRequestPost({request,env}){
 if(!auth(request,env)) return Response.json({error:'รหัสผ่านแอดมินไม่ถูกต้อง'},{status:401});
 if(!env.IMAGES) return Response.json({error:'ยังไม่ได้ตั้งค่า Cloudflare R2 binding ชื่อ IMAGES กรุณาทำขั้นตอนตั้งค่า R2 ก่อน'},{status:503});
 const form=await request.formData(); const file=form.get('image'); if(!file||typeof file==='string') return Response.json({error:'กรุณาเลือกรูปภาพ'},{status:400});
 if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)) return Response.json({error:'รองรับ JPG, PNG, WEBP และ GIF เท่านั้น'},{status:400});
 if(file.size>5*1024*1024) return Response.json({error:'ไฟล์ต้องมีขนาดไม่เกิน 5 MB'},{status:400});
 if(!env.R2_PUBLIC_URL) return Response.json({error:'กรุณาตั้งค่า R2_PUBLIC_URL เป็นโดเมนสาธารณะของ R2 ก่อนอัปโหลดรูป'},{status:503});
 const ext=({'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/gif':'gif'})[file.type]; const key='uploads/'+crypto.randomUUID()+'.'+ext;
 await env.IMAGES.put(key,await file.arrayBuffer(),{httpMetadata:{contentType:file.type,cacheControl:'public, max-age=31536000'}});
 // Use the public R2 custom domain (set as R2_PUBLIC_URL variable).
 return Response.json({success:true,url:env.R2_PUBLIC_URL.replace(/\/$/,'')+'/'+key});
}

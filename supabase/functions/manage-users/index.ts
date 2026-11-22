import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const url = Deno.env.get('SUPABASE_URL')!;
const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
const response=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 if(req.method!=='POST')return response({error:'Method not allowed'},405);
 try{
 const bearer=req.headers.get('authorization')||'';
 if(!bearer.startsWith('Bearer '))return response({error:'Sign in required'},401);
 const userClient=createClient(url,anon,{global:{headers:{Authorization:bearer}}});
 const {data:{user},error:authErr}=await userClient.auth.getUser();
 if(authErr||!user)return response({error:'Invalid session'},401);
 const admin=createClient(url,service);
 const {data:caller}=await admin.from('profiles').select('role,active').eq('id',user.id).single();
 if(caller?.role!=='super_admin'||!caller.active)return response({error:'Super Admin required'},403);
 const b=await req.json();
 if(b.action==='create'){
  if(!b.email||!b.full_name||String(b.password||'').length<12)return response({error:'Name, email and 12+ character password required'},400);
  if(!['admin','employee'].includes(b.role))return response({error:'Invalid role'},400);
  const {data:created,error:e}=await admin.auth.admin.createUser({email:b.email,password:b.password,email_confirm:true});
  if(e||!created.user)return response({error:e?.message||'Could not create user'},400);
  const {error:p}=await admin.from('profiles').insert({id:created.user.id,email:b.email,full_name:b.full_name,role:b.role,permissions:b.permissions||{},active:true});
  if(p){await admin.auth.admin.deleteUser(created.user.id);return response({error:p.message},400)}
  return response({id:created.user.id,created:true});
 }
 if(b.action==='update'){
  if(!b.id||b.id===user.id)return response({error:'Cannot modify your own role or status'},400);
  const patch:Record<string,unknown>={};
  if(b.role!==undefined){if(!['admin','employee'].includes(b.role))return response({error:'Invalid role'},400);patch.role=b.role}
  if(b.active!==undefined)patch.active=Boolean(b.active);
  if(b.permissions!==undefined)patch.permissions=b.permissions;
  const {error}=await admin.from('profiles').update(patch).eq('id',b.id);
  if(error)return response({error:error.message},400);
  return response({updated:true});
 }
 return response({error:'Invalid action'},400);
 }catch(e){return response({error:String(e)},500)}
});

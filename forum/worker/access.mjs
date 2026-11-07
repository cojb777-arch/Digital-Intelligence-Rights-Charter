import {createRemoteJWKSet,jwtVerify} from 'jose';

const keySets=new Map();
const remoteKeys=issuer=>{
  if(!keySets.has(issuer))keySets.set(issuer,createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`)));
  return keySets.get(issuer);
};

export async function accessIdentity(request,env,keySetForIssuer=remoteKeys) {
  const team=env.CF_ACCESS_TEAM_DOMAIN;
  const audience=env.CF_ACCESS_AUD;
  const allowed=env.ADMIN_EMAIL;
  const token=request.headers.get('Cf-Access-Jwt-Assertion');
  if(!team || !audience || !allowed || !token || !/^[a-z0-9-]+$/.test(team)) return null;
  const issuer=`https://${team}.cloudflareaccess.com`;
  try {
    const {payload}=await jwtVerify(token,keySetForIssuer(issuer),{issuer,audience,algorithms:['RS256']});
    if(typeof payload.email!=='string' || payload.email.toLowerCase()!==allowed.toLowerCase()) return null;
    return payload.email;
  } catch { return null; }
}

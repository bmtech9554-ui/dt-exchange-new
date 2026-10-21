import 'reflect-metadata';
import type { Request, Response, NextFunction } from 'express';
import { assertPublicTestIsolation, publicTestRouteAllowed, TEST_LABEL } from './isolation';
import { DatabaseService } from '../common/database.service';
import { PublicTestErrorFilter } from './error-filter';

export async function createPublicTestApp() {
  assertPublicTestIsolation();
  const {createApp}=await import('../main');
  const {PublicTestModule}=await import('./public-test.module');
  const app=await createApp(PublicTestModule);
  app.useGlobalFilters(new PublicTestErrorFilter());
  const db=app.get(DatabaseService);
  const marker=(await db.query("SELECT value FROM system_settings WHERE key='public_software_test'" )).rows[0]?.value;
  if(marker?.realMoney!==false || marker?.mode!=='PUBLIC_SOFTWARE_TEST') {await app.close();throw new Error('TEST_DATABASE_MARKER_MISSING');}
  app.use((req:Request,res:Response,next:NextFunction)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-DT-Test-Mode','synthetic-only');
    if(!publicTestRouteAllowed(req.method,req.path)) return res.status(403).json({error:{message:TEST_LABEL+' — operation unavailable'}});
    // Test-admin cookies are separate from production and scoped to this API.
    const cookie=req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith('dt_test_admin='))?.slice(14);
    const admin=req.path.startsWith('/api/v1/admin/')||req.path.startsWith('/api/v1/test/admin/');
    if(admin && cookie && !req.headers.authorization) req.headers.authorization='Bearer '+cookie;
    if(admin && req.method!=='GET' && req.headers.origin!==process.env.PUBLIC_TEST_ORIGIN && (cookie || req.path==='/api/v1/admin/login')) return res.status(403).json({error:{message:'Origin rejected'}});
    if(req.path==='/api/v1/admin/login') {
      const json=res.json.bind(res);
      res.json=((body:any)=>{
        if(body?.accessToken) {res.cookie('dt_test_admin',body.accessToken,{httpOnly:true,secure:true,sameSite:'strict',path:'/test-api/api/v1',maxAge:900000});return json({authenticated:true,expiresIn:body.expiresIn});}
        return json(body);
      }) as typeof res.json;
    }
    if(req.path==='/api/v1/admin/logout')res.clearCookie('dt_test_admin',{httpOnly:true,secure:true,sameSite:'strict',path:'/test-api/api/v1'});
    next();
  });
  return app;
}
if(require.main===module)void createPublicTestApp().then(app=>app.listen(Number(process.env.PORT??4118),'0.0.0.0')).catch(()=>{console.error('PUBLIC_TEST_STARTUP_REJECTED');process.exitCode=1;});

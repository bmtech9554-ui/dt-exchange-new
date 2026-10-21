import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dt_exchange/core/design/appearance.dart';
import 'package:dt_exchange/core/design/theme.dart';
import 'package:dt_exchange/features/referral/production_referral_page.dart';
import 'test_support.dart';

void main(){
 setUpAll(loadPreviewFonts);
 setUp(()=>FlutterSecureStorage.setMockInitialValues({}));
 for(final mode in [ThemeMode.light,ThemeMode.dark]){
  for(final route in ['/home','/wallet','/history','/profile','/deposit','/sell','/banks','/settings','/support']){
   testWidgets('$mode narrow large-text layout $route',(t)async{
    t.platformDispatcher.accessibilityFeaturesTestValue=FakeAccessibilityFeatures(disableAnimations:true);
    final c=await pumpPreview(t,route:route,size:const Size(360,800),scale:1.3);
    await c.read(appearanceProvider.notifier).select(mode);await t.pump();await t.pump(const Duration(milliseconds:400));
    expect(t.takeException(),null);expect(Theme.of(t.element(find.byType(Scaffold).first)).brightness,mode==ThemeMode.dark?Brightness.dark:Brightness.light);
    await closePreview(t,c);t.platformDispatcher.clearAccessibilityFeaturesTestValue();
   });
  }
 }
 testWidgets('production referral stats and history fit dark narrow layout',(t)async{
  t.view.physicalSize=const Size(360,900);t.view.devicePixelRatio=1;addTearDown(t.view.resetPhysicalSize);addTearDown(t.view.resetDevicePixelRatio);
  final boundary=GlobalKey();
  await t.pumpWidget(ProviderScope(overrides:[referralOverviewProvider.overrideWith((ref)async=>{'code':'DT1234567890ABCDEF','inviteLink':'https://dtexchange.app/invite?ref=DT1234567890ABCDEF','registrationPolicy':{'enabled':true,'rewardUsdt':'0.1'},'totalReferrals':2,'totalEarnedUsdt':'0.2','availableReferralBalanceUsdt':'0.1','history':[{'referred_public_user_id':'1001','reward_usdt':'0.1','reward_status':'PENDING_MANUAL_RELEASE','created_at':'2026-10-08T00:00:00Z'}]})],child:MaterialApp(theme:dtDarkTheme,home:MediaQuery(data:const MediaQueryData(size:Size(360,900),disableAnimations:true,textScaler:TextScaler.linear(1.2)),child:RepaintBoundary(key:boundary,child:const ProductionReferralPage())))));
  await t.pump();await t.pump(const Duration(seconds:1));expect(find.text('Invite & Earn'),findsOneWidget);expect(t.takeException(),null);
  await t.runAsync(()async{final image=await (boundary.currentContext!.findRenderObject() as RenderRepaintBoundary).toImage();final bytes=await image.toByteData(format:ui.ImageByteFormat.png);await Directory('../.tools/master-visuals').create(recursive:true);await File('../.tools/master-visuals/referral-dark.png').writeAsBytes(bytes!.buffer.asUint8List());image.dispose();});
 });
}

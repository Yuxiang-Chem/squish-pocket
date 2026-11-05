from urllib.parse import urlparse
from playwright.sync_api import sync_playwright,expect
import os,json,time
url=os.environ.get('SQUISH_TEST_URL','http://localhost:4184');ids=['classic','lab-flask','classic-water','lab-flask-water','separating-funnel','conical-flask','separating-funnel-water','conical-flask-water']
assert urlparse(url).hostname in ['localhost','127.0.0.1','squish-test.chemisgreat.online','squish.chemisgreat.online']
with sync_playwright() as p:
 for name in ['chromium','webkit']:
  b=getattr(p,name).launch()
  for language in ['zh-CN','en']:
   page=b.new_page(viewport={'width':320,'height':568});page.add_init_script('localStorage.setItem("squish-pocket-language-v1",'+json.dumps(language)+')');state={'holder':True};errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   def records(route):
    board={'record':None,'leaderboard':[],'highestTile':2,'isRecordHolder':False};record={'name':'Classic','score':24,'highestTile':4};bottles={id:{**board,**({'recordEpoch':2} if id=='lab-flask' else {})} for id in ids};bottles['classic']={**board,'record':record,'leaderboard':[{'name':'Classic','score':24,'rank':1}],'isRecordHolder':state['holder']};route.fulfill(status=200,json={**board,'mergeMode':'two','milestone':2048,'reachedMilestone':0,'totalMilestones':0,'milestoneTrackingSince':int(time.time()*1000),'emailReady':True,'bottles':bottles})
   page.route('**/api/**',lambda r:r.abort());page.route('**/api/achievements*',records);page.route('https://fonts.googleapis.com/**',lambda r:r.abort());page.route('https://fonts.gstatic.com/**',lambda r:r.abort());page.goto(url,wait_until='domcontentloaded');expect(page.locator('#champion-page')).to_be_visible();hint=page.locator('.champion-message-hint');expect(hint).to_have_text('只有当前纪录保持者可以给创作者留言。随便说点什么，开心就好！' if language=='zh-CN' else 'Only the current record holder can message the creator. Say anything—have fun!');expect(page.locator('#champion-email')).to_be_enabled();assert page.locator('#champion-page').evaluate('d=>d.scrollWidth<=d.clientWidth+1');page.locator('#champion-email').scroll_into_view_if_needed();page.screenshot(path='/tmp/squish-pocket-qa/'+name+'-champion-note-'+language+'.png');state['holder']=False;page.evaluate('window.dispatchEvent(new Event("online"))');expect(page.locator('#champion-email')).to_be_disabled(timeout=15000);assert not errors,errors;page.close()
  print(json.dumps({'browser':name,'bilingualRecordHolderNote':True,'phoneDialogFits':True,'onlyCurrentHolderCanMessage':True,'messagesSent':False}),flush=True);b.close()

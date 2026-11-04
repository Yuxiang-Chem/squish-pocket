import {test} from 'node:test';
import assert from 'node:assert/strict';
import {announcementActive,ANNOUNCEMENT_DURATION,renderThreeAnnouncement} from '../dist/announcement.js';
test('Three Combine notice is active for exactly two days from publication',()=>{
 const publishedAt=1800000000000,notice={publishedAt,expiresAt:publishedAt+ANNOUNCEMENT_DURATION};
 assert.equal(ANNOUNCEMENT_DURATION,172800000);
 assert.equal(announcementActive(notice,publishedAt-1),false);
 assert.equal(announcementActive(notice,publishedAt),true);
 assert.equal(announcementActive(notice,notice.expiresAt-1),true);
 assert.equal(announcementActive(notice,notice.expiresAt),false);
 assert.equal(announcementActive(notice,notice.expiresAt+1),false);
 assert.equal(announcementActive(null,publishedAt),false);
 assert.equal(announcementActive({...notice,expiresAt:notice.expiresAt+1},publishedAt),false);
});
test('notice hides at expiry while the page remains open, and stays hidden for Two Combine',t=>{
 const now=Date.now();t.mock.timers.enable({apis:['Date','setTimeout'],now});
 const notice={publishedAt:now-1000,expiresAt:now+ANNOUNCEMENT_DURATION-1000};
 const element={hidden:true,classList:{toggle(_class,hidden){element.hidden=hidden;},add(){element.hidden=true;}}};
 renderThreeAnnouncement(element,'two',notice);assert.equal(element.hidden,true);
 renderThreeAnnouncement(element,'three',notice);assert.equal(element.hidden,false);
 t.mock.timers.tick(ANNOUNCEMENT_DURATION-1001);assert.equal(element.hidden,false);
 t.mock.timers.tick(1);assert.equal(element.hidden,true);
 renderThreeAnnouncement(element,'three',notice);assert.equal(element.hidden,true);
});

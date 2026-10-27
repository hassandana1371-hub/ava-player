const {test}=require('node:test');const assert=require('node:assert/strict');const {emptyLane,position,updateLane}=require('../app/state.cjs');
test('cueing next file leaves current output and clock intact',()=>{let l=updateLane(emptyLane(0),'cue','a',0);l=updateLane(l,'take',null,1000);const next=updateLane(l,'cue','b',3000);assert.equal(next.mediaId,'a');assert.equal(next.previewId,'b');assert.equal(position(next,4000),3);assert.equal(updateLane(next,'take',null,4000).mediaId,'b');});
test('pause resume seek stop preserve shared playback timeline',()=>{let l=updateLane({...emptyLane(1),mediaId:'a'},'play',null,1000);l=updateLane(l,'pause',null,3500);assert.equal(position(l,9000),2.5);l=updateLane(l,'play',null,10000);assert.equal(position(l,11000),3.5);l=updateLane(l,'seek',20,11000);assert.equal(position(l,12000),21);l=updateLane(l,'stop',null,12000);assert.equal(position(l,19000),0);assert.equal(l.playing,false);});
test('five lanes remain independent and permit duplicate monitor selection',()=>{const lanes=Array.from({length:5},(_,i)=>emptyLane(i));lanes[0]=updateLane(lanes[0],'monitorId','same');lanes[4]=updateLane(lanes[4],'monitorId','same');lanes[0]=updateLane(lanes[0],'blackout',true);assert.equal(lanes[4].monitorId,'same');assert.equal(lanes[4].blackout,false);assert.equal(lanes[1].monitorId,null);});
test('play while already playing is idempotent',()=>{const l={...emptyLane(0),mediaId:'a',playing:true,offset:2,epoch:1000};assert.equal(position(updateLane(l,'play',null,3000),4000),5);});
test('dropping on a final loads and starts the chosen media atomically, including a repeated drop',()=>{
 const previous={...emptyLane(2),previewId:'old-cue',mediaId:'old-live',offset:17,playing:false,blackout:true,monitorId:'screen-2',volume:0.3};
 const loaded=updateLane(previous,'load','new-file',9000);
 assert.equal(loaded.mediaId,'new-file');assert.equal(loaded.previewId,'new-file');assert.equal(position(loaded,9000),0);
 assert.equal(loaded.playing,true);assert.equal(loaded.blackout,false);assert.equal(loaded.monitorId,'screen-2');assert.equal(loaded.volume,0.3);
 const again=updateLane(loaded,'load','new-file',12000);assert.equal(position(again,12000),0);
 assert.equal(previous.mediaId,'old-live');
});

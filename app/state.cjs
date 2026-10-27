const emptyLane = id => ({id, mediaId:null, previewId:null, monitorId:null, playing:false, offset:0, epoch:0, loop:true, fit:'contain', volume:0.8, slideSeconds:5, blackout:false});
const position = (lane, now=Date.now()) => lane.offset + (lane.playing ? Math.max(0,now-lane.epoch)/1000 : 0);
function updateLane(lane, action, value, now=Date.now()) {
  switch(action) {
    case 'cue': return {...lane,previewId:value};
    case 'take': return {...lane,mediaId:lane.previewId,offset:0,epoch:now,playing:!!lane.previewId,blackout:false};
    case 'play': return lane.playing ? lane : {...lane,epoch:now,playing:!!lane.mediaId};
    case 'pause': return {...lane,offset:position(lane,now),playing:false};
    case 'stop': return {...lane,offset:0,playing:false};
    case 'seek': return {...lane,offset:Math.max(0,Number(value)||0),epoch:now};
    case 'monitorId': return {...lane,monitorId:value};
    case 'loop': case 'blackout': return {...lane,[action]:!!value};
    case 'fit': return {...lane,fit:['contain','cover','fill'].includes(value)?value:'contain'};
    case 'volume': return {...lane,volume:Math.min(1,Math.max(0,Number(value)||0))};
    case 'slideSeconds': return {...lane,slideSeconds:Math.min(60,Math.max(1,Number(value)||5))};
    default: throw Error('Unknown action');
  }
}
module.exports={emptyLane,position,updateLane};

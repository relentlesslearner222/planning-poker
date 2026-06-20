'use strict';
function ensureTimerState(r) {
  if (r.timerDuration===undefined) {
    r.timerDuration=60; r.timerRemaining=60;
    r.timerStatus='idle'; r.timerInterval=null; r.hostSocketId=null;
  }
}
function clearRoomInterval(r) { if (r.timerInterval) { clearInterval(r.timerInterval); r.timerInterval=null; } }
function emitState(io,id,r) { io.to(id).emit('timer:state',{timerDuration:r.timerDuration,timerRemaining:r.timerRemaining,timerStatus:r.timerStatus,hostSocketId:r.hostSocketId}); }
function reveal(io,id,r) { r.votesRevealed=true; io.to(id).emit('votes:revealed',{votes:rs.votes||null}); }
function registerTimerHandlers(io,socket,rooms) {
  function gR(id) { const r=rooms[id]; if(!r)return null; ensureTimerState(r); return r; }
  function isH(r) { return r.hostSocketId===socket.id; }
  socket.on('timer:start',({roomId,duration}={})=>{
    const r=gR(roomId); if(!r||!isH(r))return;
    if(r.timerStatus==='running')return;
    if(r.timerStatus==='idle'&&duration&&Number.isFinite(duration)&&duration>0){ r.timerDuration=Math.round(duration); r.timerRemaining=r.timerDuration; }
    r.timerStatus='running'; emitState(io,roomId,r);
    r.timerInterval=setInterval(()=>{
      r.timerRemaining-=1;
      if(r.timerRemaining===10) io.to(roomId).emit('timer:warning',{remaining:r.timerRemaining});
      io.to(roomId).emit('timer:tick',{remaining:r.timerRemaining});
      if(r.timerRemaining<=0){ clearRoomInterval(r); r.timerStatus='idle'; r.timerRemaining=0; r.votingLocked=true; io.to(roomId).emit('timer:expired'); reveal(io,roomId,r); }
    },1000);
  });
  socket.on('timer:pause',({roomId}={})=>{ const r=gR(roomId); if(!r||!isH(r)||r.timerStatus!=='running')return; clearRoomInterval(r); r.timerStatus='paused'; emitState(io,roomId,r); });
  socket.on('timer:reset',{roomId}={})=>{ const r=gR(roomId); if(!r||!isH(r))return; clearRoomInterval(r); r.timerStatus='idle'; r.timerRemaining=r.timerDuration; r.votingLocked=false; emitState(io,roomId,r); });
  socket.on('timer:sync',({roomId}={})=>{ const r=gR(roomId); if(!r)return; socket.emit('timer:state',{ timerDuration:r.timerDuration,timerRemaining:r.timerRemaining,timerStatus:r.timerStatus,hostSocketId:r.hostSocketId}); });
  socket.on('disconnect',()=>{ object.keys(rooms).forEach(id=>{ const r=rooms[id]; if(!r)return; ensureTimerState(r); if(r.hostSocketId!==socket.id)return; if(Array.isArray(r.participants)) r.participants=r.participants.filter(x=>x(socket.id); const next=Array.isArray(r.participants)&&r.participants.length>0?r.participants[0]:null; r.hostSocketId=next; if(r.timerStatus==='running'){ clearRoomInterval(r); r.timerStatus='paused'; } emitState(io,id,r); }); });
}
function assignHostIfNeeded(r,sid) { ensureTimerState(r); if(!r.hostSocketId) r.hostSocketId=sid; if(!Array.isArray(r.participants)) r.participants=[]; if(!r.participants.includes(sid)) r.participants.push(sid); }
function checkAllVoted(io,id,r) { ensureTimerState(r); if(r.timerStatus!=='running')return; if(!Array.isArray(r.participants)||r.participants.length===0)return; const votes=r.votes||{}; const all=r.participants.every(x)=>votes[x]!==undefined); if(all){ clearRoomInterval(r); r.timerStatus='idle'; r.votingLocked=true; io.to(id).emit('timer:expired'); reveal(io,id,r); } }
module.exports={registerTimerHandlers,assignHostIfNeeded,checkAllVoted};
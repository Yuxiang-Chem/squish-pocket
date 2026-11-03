export class DragMotion{
  constructor(reduced=false){this.reduced=reduced;this.active=false;this.trail=[];}
  start(x,y,time=0){this.active=true;this.x=x;this.y=y;this.tx=x;this.ty=y;this.vx=0;this.vy=0;this.time=time;this.idle=0;this.age=0;this.trail=[];}
  move(x,y,time){
    const dt=Math.max(.008,Math.min(.1,(time-this.time)/1000));
    this.vx=this.vx*.35+Math.max(-1100,Math.min(1100,(x-this.tx)/dt))*.65;
    this.vy=this.vy*.35+Math.max(-1100,Math.min(1100,(y-this.ty)/dt))*.65;
    this.tx=x;this.ty=y;this.time=time;this.idle=0;
  }
  update(dt){
    if(!this.active)return;
    this.age+=dt;this.idle+=dt;const follow=this.reduced?1:1-Math.exp(-32*dt);
    this.x+=(this.tx-this.x)*follow;this.y+=(this.ty-this.y)*follow;
    if(this.idle>.04){this.vx*=Math.exp(-10*dt);this.vy*=Math.exp(-10*dt);}
    if(!this.reduced){this.trail.push({x:this.x,y:this.y,age:0});this.trail=this.trail.slice(-7);for(const p of this.trail)p.age+=dt;}
  }
  pose(stiffness=30){
    const softness=1-stiffness/140,ex=Math.min(.32,Math.abs(this.vx)/2300)*softness,ey=Math.min(.4,Math.abs(this.vy)/2000)*softness;
    const norm=Math.sqrt((1+ex)*(1+ey));
    return {x:this.x,y:this.y,sx:(1+ex)/norm,sy:(1+ey)/norm,tilt:this.reduced?0:Math.max(-.13,Math.min(.13,this.vx/6500))};
  }
  velocity(){return {vx:this.vx,vy:this.vy};}
  stop(){this.active=false;this.trail=[];}
}

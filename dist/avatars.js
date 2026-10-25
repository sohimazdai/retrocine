import * as T from 'three';import {RoundedBoxGeometry} from './vendor/RoundedBoxGeometry.js';
const geometries=new Map(),materials=new Map();
export function material(color,roughness=.65){const k=color+'|'+roughness;if(!materials.has(k))materials.set(k,new T.MeshStandardMaterial({color,roughness,metalness:roughness<.2?.08:0}));return materials.get(k)}
export function rounded(w,h,d,r=.08){const key=[w,h,d,r].join();if(!geometries.has(key))geometries.set(key,new RoundedBoxGeometry(w,h,d,3,r));return geometries.get(key)}
export function box(parent,w,h,d,color,x=0,y=0,z=0,r=.06){const m=new T.Mesh(rounded(w,h,d,r),typeof color==='string'?material(color):color);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
const ballGeo=new T.SphereGeometry(1,20,14);export function ball(parent,color,x,y,z,sx,sy=sx,sz=sx,rough=.6){const m=new T.Mesh(ballGeo,material(color,rough));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;parent.add(m);return m}
export function avatar(p){
 const root=new T.Group(),model=new T.Group();root.add(model);const clothes=p.color||'#ae92d6',skin=p.skin||'#e4b59b',hair=p.hairColor||'#493339';
 const torso=box(model,.43,.46,.31,clothes,0,.52,0,.09);box(model,.24,.09,.33,'#f0e8ed',0,.69,0,.04);box(model,.2,.13,.2,skin,0,.82,0,.05);
 const legs=[],arms=[];for(const side of [-1,1]){const leg=new T.Group();leg.position.set(side*.12,.27,0);model.add(leg);box(leg,.16,.23,.17,'#403949',0,-.07,0,.05);box(leg,.2,.12,.29,'#f2ebed',0,-.22,.045,.045);legs.push(leg);const arm=new T.Group();arm.position.set(side*.28,.67,0);model.add(arm);box(arm,.16,.25,.18,clothes,0,-.1,0,.06);ball(arm,skin,0,-.26,.01,.085,.095,.085);arms.push(arm)}
 const head=new T.Group();head.position.set(0,1.15,0);model.add(head);box(head,.82,.74,.69,skin,0,0,0,.16);
 for(const s of [-1,1]){ball(head,skin,s*.42,-.04,0,.068,.11,.085);ball(head,'#17131b',s*.215,.02,.335,.139,.158,.073,.1);ball(head,'#ffffff',s*.215-.035,.073,.399,.031,.033,.012,.12);ball(head,'#af8a99',s*.215+.045,-.025,.399,.014,.016,.009,.15);const brow=box(head,.18,.028,.025,hair,s*.22,.225,.348,.01);brow.rotation.z=-s*.09;ball(head,'#d58a8e',s*.26,-.16,.338,.065,.025,.015)}
 ball(head,skin,0,-.075,.371,.045,.045,.055);ball(head,'#aa5c69',-.027,-.224,.36,.044,.019,.018);ball(head,'#aa5c69',.027,-.224,.36,.044,.019,.018);ball(head,'#cb7b84',0,-.245,.358,.06,.018,.018);box(head,.075,.009,.009,'#6b3f4a',0,-.235,.378,.003);
 const style=p.hat||'headphones';if(style!=='bald'){
 box(head,.85,.23,.72,hair,0,.31,-.03,.11);box(head,.81,.48,.17,hair,0,.1,-.32,.08);
 for(let i=0;i<5;i++){const m=box(head,.24,.17,.2,hair,-.29+i*.14,.26+Math.sin(i*.8)*.07,.28,.07);m.rotation.z=.15-i*.1;}
 for(const s of [-1,1])box(head,.105,.25,.32,hair,s*.37,.07,-.01,.05);
 if(style==='long'){for(const s of [-1,1]){box(head,.15,.67,.46,hair,s*.39,-.04,-.06,.06);box(head,.19,.38,.24,hair,s*.35,-.29,-.24,.07)}box(head,.75,.6,.21,hair,0,-.08,-.36,.07)}
 if(style==='bun'){ball(head,hair,0,.51,-.14,.22,.2,.21);ball(head,hair,.06,.62,-.18,.13);}
 }
 if(style==='cap'){box(head,.88,.2,.74,'#64765c',0,.36,0,.09);box(head,.75,.065,.33,'#778c6b',0,.27,.44,.04);box(head,.15,.09,.02,'#c7d7ae',0,.38,.38,.02)}
 if(style==='headphones'){const band=new T.Mesh(new T.TorusGeometry(.46,.035,8,36,Math.PI),material('#dac8f0'));band.position.set(0,.04,-.04);head.add(band);for(const s of [-1,1]){box(head,.13,.27,.29,'#b39ad4',s*.46,-.025,-.01,.055);box(head,.03,.18,.18,'#d9c7ed',s*.53,-.025,-.01,.025)}}
 if(style==='glasses'){for(const s of [-1,1]){const rim=new T.Mesh(new T.TorusGeometry(.167,.018,8,30),material('#3a3044'));rim.position.set(s*.215,.02,.42);rim.scale.y=1.08;head.add(rim)}box(head,.1,.022,.025,'#3a3044',0,.055,.42,.005)}
 root.userData={kind:'avatar',id:p.id};return {root,model,head,legs,arms};
}

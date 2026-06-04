// Flight Chess v10 — authentic Ludo board: interleaved colors, jump cells, fly-across lines
(function() {
  window.gameRenderers = window.gameRenderers || new Map();

  // Player colors: red, green, blue, yellow
  var CO  = ['#e63535','#22b06b','#3a7ee0','#e8b81c'];
  var COL = ['#fbe4e4','#dff5ec','#e2edfb','#faf2cf']; // light base panel bg
  var COD = ['#b71f1f','#177a48','#1d5bb0','#b08810']; // dark accent

  var SZ=15, PP=4;
  // Main track: 52 cells. Player p enters at index p*13. Cell color = index % 4.
  var TK=[
    [8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,6],[9,6],[10,6],[11,6],[12,6],[13,6],[14,6],
    [14,8],[13,8],[12,8],[11,8],[10,8],[9,8],[8,8],[8,9],[8,10],[8,11],[8,12],[8,13],[8,14],
    [6,14],[6,13],[6,12],[6,11],[6,10],[6,9],[6,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8],
    [0,6],[1,6],[2,6],[3,6],[4,6],[5,6],[6,6],[6,5],[6,4],[6,3],[6,2],[6,1],[6,0]
  ];
  // Home stretch: 6 cells each, from arm edge inward to center (matches travel direction)
  var HM=[
    [7,1],[7,2],[7,3],[7,4],[7,5],[7,6],       // p0 red  — left arm → center
    [13,7],[12,7],[11,7],[10,7],[9,7],[8,7],    // p1 green — bottom arm → center
    [7,13],[7,12],[7,11],[7,10],[7,9],[7,8],    // p2 blue  — right arm → center
    [1,7],[2,7],[3,7],[4,7],[5,7],[6,7]         // p3 yellow— top arm → center
  ];
  var BS=[{r:0,c:9},{r:9,c:9},{r:9,c:0},{r:0,c:0}]; // base corners: red,green,blue,yellow
  var LAUNCH=[0,13,26,39];          // launch cell index of each player (own color)
  var FLY_STEP=8, FLY_ADV=24;       // must match games/flightchess.js
  // Home-entrance inward arrow per player (direction toward center)
  var HOME_ARROW=['▶','▲','◀','▼'];

  var cvs,ctx,W,cnt;

  function cellSize(){return W/SZ;}
  function gp(gx,gy){var cs=cellSize();return{x:gx*cs+cs/2,y:gy*cs+cs/2};}
  function rr(x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.arcTo(x+w,y,x+w,y+r,r);ctx.lineTo(x+w,y+h-r);ctx.arcTo(x+w,y+h,x+w-r,y+h,r);ctx.lineTo(x+r,y+h);ctx.arcTo(x,y+h,x,y+h-r,r);ctx.lineTo(x,y+r);ctx.arcTo(x,y,x+r,y,r);ctx.closePath();}
  function tile(gx,gy,color){var cs=cellSize(),g=cs*.07;ctx.fillStyle=color;ctx.beginPath();rr(gx*cs+g,gy*cs+g,cs-2*g,cs-2*g,cs*.24);ctx.fill();}

  window.gameRenderers.set('flightchess',{
    init:function(container){
      cnt=container;
      container.innerHTML=
        '<div style="width:100%;display:flex;flex-direction:column;align-items:center;gap:10px;">'+
        '<canvas id="fcCanvas" style="display:block;border-radius:16px;touch-action:manipulation;cursor:pointer;box-shadow:0 6px 28px rgba(0,0,0,.18);"></canvas>'+
        '<div id="fcDice" style="display:flex;align-items:center;justify-content:center;gap:12px;min-height:60px;"></div>'+
        '<div id="fcInfo" style="font-size:15px;color:#666;font-weight:600;text-align:center;min-height:22px;"></div>'+
        '<button id="fcRollBtn" class="btn btn-accent" style="font-size:17px;padding:13px 48px;border-radius:30px;">🎲 掷骰子</button>'+
        '</div>';
      cvs=document.getElementById('fcCanvas');ctx=cvs.getContext('2d');

      var rs=function(){
        var avW=window.innerWidth-(window.innerWidth>600?80:28);
        var avH=window.innerHeight-260;
        var pw=Math.min(avW,avH,920);
        pw=Math.max(pw,260);
        var dpr=window.devicePixelRatio||1;W=pw;
        cvs.width=pw*dpr;cvs.height=pw*dpr;
        cvs.style.width=pw+'px';cvs.style.height=pw+'px';
        ctx.setTransform(1,0,0,1,0,0);ctx.scale(dpr,dpr);
        if(window._fcSt)window.gameRenderers.get('flightchess').render(window._fcSt,cnt,parseInt(sessionStorage.getItem('playerIndex')),window._fcSt.winner);
      };
      rs();window.addEventListener('resize',rs);

      document.getElementById('fcRollBtn').addEventListener('click',function(){
        var s=window._fcSt;if(!s)return;
        var pi=parseInt(sessionStorage.getItem('playerIndex'));
        if(s.currentPlayer===pi&&!s.hasRolled&&s.winner==null)window.makeGameMove({action:'roll'});
      });
      cvs.addEventListener('click',function(e){
        var s=window._fcSt;if(!s||s.winner!=null)return;
        var pi=parseInt(sessionStorage.getItem('playerIndex'));
        if(s.currentPlayer!==pi||!s.hasRolled)return;
        var rect=cvs.getBoundingClientRect(),mx=(e.clientX-rect.left)*W/rect.width,my=(e.clientY-rect.top)*W/rect.height;
        var hits=window._fcHb||[];
        for(var i=hits.length-1;i>=0;i--){var h=hits[i];if(Math.abs(mx-h.x)<h.r+8&&Math.abs(my-h.y)<h.r+8&&h.pi===pi){window.makeGameMove({action:'move',planeIndex:h.idx});return;}}
      });
    },

    render:function(s,container,pi,wr){
      window._fcSt=s;if(!cvs)return;
      ctx.clearRect(0,0,W,W);window._fcHb=[];
      var cs=cellSize();

      // === Background (canvas only — page stays light) ===
      ctx.fillStyle='#1a2540';ctx.fillRect(0,0,W,W);

      // === Track cells — interleaved colors (index % 4) ===
      TK.forEach(function(tc,i){
        tile(tc[0],tc[1],CO[i%4]);
      });

      // === Launch cells — plane emoji (no arrows) ===
      LAUNCH.forEach(function(li,p){
        var pt=gp(TK[li][0],TK[li][1]);
        ctx.fillStyle='rgba(255,255,255,0.95)';
        ctx.font=(cs*.55)+'px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText('✈',pt.x,pt.y);
      });

      // === Fly-across paths (dashed lines forming a pinwheel through center) ===
      for(var p=0;p<4;p++){
        var fromAbs=(p*13+FLY_STEP)%52, toAbs=(p*13+FLY_STEP+FLY_ADV)%52;
        var a=gp(TK[fromAbs][0],TK[fromAbs][1]), b=gp(TK[toAbs][0],TK[toAbs][1]);
        // white casing under the colored dash for visibility over any cell
        ctx.lineCap='round';
        ctx.strokeStyle='rgba(255,255,255,0.85)';ctx.lineWidth=cs*.16;
        ctx.setLineDash([cs*.26,cs*.2]);
        ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
        ctx.strokeStyle=CO[p];ctx.lineWidth=cs*.09;
        ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
        ctx.setLineDash([]);
        // arrowhead at destination
        var ang=Math.atan2(b.y-a.y,b.x-a.x),ah=cs*.34;
        ctx.fillStyle=CO[p];
        ctx.beginPath();
        ctx.moveTo(b.x,b.y);
        ctx.lineTo(b.x-ah*Math.cos(ang-0.4),b.y-ah*Math.sin(ang-0.4));
        ctx.lineTo(b.x-ah*Math.cos(ang+0.4),b.y-ah*Math.sin(ang+0.4));
        ctx.closePath();ctx.fill();
        // fly source marker: white disc + ✈ in player color
        ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(a.x,a.y,cs*.32,0,6.28);ctx.fill();
        ctx.strokeStyle=CO[p];ctx.lineWidth=cs*.08;ctx.beginPath();ctx.arc(a.x,a.y,cs*.32,0,6.28);ctx.stroke();
        ctx.fillStyle=CO[p];ctx.font='bold '+(cs*.4)+'px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillText('✈',a.x,a.y);
      }

      // === Home stretch cells (owner color, turn-in arrow only on first cell) ===
      for(var p=0;p<4;p++){
        for(var h=0;h<6;h++){
          var hc=HM[p*6+h];tile(hc[0],hc[1],CO[p]);
          if(h===0){
            var pt2=gp(hc[0],hc[1]);
            ctx.fillStyle='rgba(255,255,255,0.85)';ctx.font='bold '+(cs*.44)+'px system-ui';
            ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(HOME_ARROW[p],pt2.x,pt2.y);
          }
        }
      }

      // === Bases (6×6 corner panels) ===
      BS.forEach(function(bc,bi){
        var bx=bc.c*cs,by=bc.r*cs,bw=6*cs,bh=6*cs,g=cs*.12;
        ctx.fillStyle=COL[bi];
        ctx.beginPath();rr(bx+g,by+g,bw-2*g,bh-2*g,cs*.55);ctx.fill();
        ctx.strokeStyle=CO[bi];ctx.lineWidth=cs*.1;
        ctx.beginPath();rr(bx+g,by+g,bw-2*g,bh-2*g,cs*.55);ctx.stroke();
        for(var si=0;si<4;si++){
          var sx=bx+bw*(.22+(si%2)*.56),sy=by+bh*(.22+(si<2?0:.56));
          ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(sx,sy,cs*.4,0,6.28);ctx.fill();
          ctx.strokeStyle=CO[bi];ctx.lineWidth=cs*.06;ctx.beginPath();ctx.arc(sx,sy,cs*.4,0,6.28);ctx.stroke();
        }
      });

      // === Center — 4 colored triangles + white hub ===
      var ccx=7.5*cs,ccy=7.5*cs,reach=cs*1.5;
      var corners=[{x:ccx+reach,y:ccy-reach},{x:ccx+reach,y:ccy+reach},{x:ccx-reach,y:ccy+reach},{x:ccx-reach,y:ccy-reach}];
      var triEdges=[[0,1],[1,2],[2,3],[3,0]];
      for(var t=0;t<4;t++){
        var e=triEdges[t];ctx.fillStyle=CO[t];
        ctx.beginPath();ctx.moveTo(ccx,ccy);ctx.lineTo(corners[e[0]].x,corners[e[0]].y);ctx.lineTo(corners[e[1]].x,corners[e[1]].y);ctx.closePath();ctx.fill();
        ctx.strokeStyle='rgba(255,255,255,0.35)';ctx.lineWidth=1.5;ctx.stroke();
      }
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ccx,ccy,cs*.34,0,6.28);ctx.fill();
      ctx.strokeStyle='rgba(0,0,0,.12)';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(ccx,ccy,cs*.34,0,6.28);ctx.stroke();

      // === Planes ===
      var pR=cs*.4;
      for(var pli=0;pli<s._playerCount;pli++){
        var pd=s.players[pli];if(!pd)continue;
        for(var i=0;i<PP;i++){
          var pos=pd.planes[i],px2,py2;
          if(pos===-1){var bc2=BS[pli];px2=bc2.c*cs+6*cs*(.22+(i%2)*.56);py2=bc2.r*cs+6*cs*(.22+(i<2?0:.56));}
          else if(pos>=58){var bc3=BS[pli];px2=bc3.c*cs+3*cs;py2=bc3.r*cs+3*cs;}
          else if(pos>=52){var hi2=pos-52;var hc2=hi2<6?HM[pli*6+hi2]:[7,7];var hp2=gp(hc2[0],hc2[1]);px2=hp2.x;py2=hp2.y;}
          else{var ab=(pli*13+pos)%52;var tp=gp(TK[ab][0],TK[ab][1]);px2=tp.x;py2=tp.y;}
          ctx.fillStyle='rgba(0,0,0,0.28)';ctx.beginPath();ctx.arc(px2+2.5,py2+3.5,pR,0,6.28);ctx.fill();
          var pgr=ctx.createRadialGradient(px2-pR*.3,py2-pR*.3,pR*.05,px2,py2,pR);
          pgr.addColorStop(0,'#fff');pgr.addColorStop(0.5,CO[pli]);pgr.addColorStop(1,COD[pli]);
          ctx.fillStyle=pgr;ctx.strokeStyle='#fff';ctx.lineWidth=cs*.05;
          ctx.beginPath();ctx.arc(px2,py2,pR,0,6.28);ctx.fill();ctx.stroke();
          ctx.fillStyle='#fff';ctx.font=(pR*.95)+'px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('✈',px2,py2);
          if(pli===parseInt(sessionStorage.getItem('playerIndex'))&&s.hasRolled&&s.currentPlayer===pli&&pos!==58){
            ctx.strokeStyle='#ffe24d';ctx.lineWidth=cs*.08;ctx.setLineDash([cs*.16,cs*.1]);
            ctx.beginPath();ctx.arc(px2,py2,pR+cs*.14,0,6.28);ctx.stroke();ctx.setLineDash([]);
            window._fcHb.push({x:px2,y:py2,r:pR+cs*.14,pi:pli,idx:i});
          }
        }
      }

      // === DICE display (below board — always shows the rolled number) ===
      var diceEl=document.getElementById('fcDice');
      if(diceEl){
        var dv=s.dice;
        if(s.hasRolled&&dv){
          var who=s.currentPlayer,wc=CO[who]||'#333';
          var wn=(window.gamePlayers&&window.gamePlayers[who])?window.gamePlayers[who].name:'玩家'+(who+1);
          diceEl.innerHTML=dieBox(dv,wc)+'<span style="font-size:18px;font-weight:800;color:'+wc+';">'+wn+' 掷出 '+dv+' 点</span>';
        } else if(dv){
          diceEl.innerHTML=dieBox(dv,'#888')+'<span style="font-size:16px;font-weight:700;color:#888;">上一手 '+dv+' 点</span>';
        } else {
          diceEl.innerHTML='<span style="font-size:40px;opacity:.25;">🎲</span>';
        }
      }

      // === Info & button ===
      var info=document.getElementById('fcInfo'),btn=document.getElementById('fcRollBtn');
      var my=s.currentPlayer===pi&&s.winner==null;
      if(info){
        var turnTxt;
        if(s.winner!=null)turnTxt=s.winner===pi?'🏆 你赢了！':'😢 你输了';
        else if(my)turnTxt=s.hasRolled?'点击发光的 ✈ 走棋':'轮到你掷骰子';
        else{var ci=window.gamePlayers&&window.gamePlayers[s.currentPlayer];var nm2=ci?ci.name:'对手';turnTxt=s.hasRolled?'🕐 '+nm2+' 正在走棋…':'🕐 等待 '+nm2+' 掷骰';}
        // highlight last special action (jump / fly / stomp) so it's clear what happened
        var lr=s.lastMoveResult||'';
        var special=/飞到对面|跳|踩/.test(lr);
        info.innerHTML=turnTxt+(special?'<br><span style="color:#c8a45c;font-weight:800;">'+lr+'</span>':'');
      }
      if(btn)btn.style.display=(my&&!s.hasRolled&&s.winner==null)?'':'none';
    }
  });

  // A die face showing the rolled number in a styled box
  function dieBox(n,color){
    return '<span style="display:inline-flex;width:54px;height:54px;border-radius:13px;background:#fff;'+
      'border:3px solid '+color+';align-items:center;justify-content:center;'+
      'font-size:32px;font-weight:900;color:'+color+';box-shadow:0 3px 10px rgba(0,0,0,.15);">'+n+'</span>';
  }
})();

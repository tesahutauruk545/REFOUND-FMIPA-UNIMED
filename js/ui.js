(function(){
var inPages=location.pathname.indexOf("/pages/")>-1,base=inPages?"":"pages/";
var path=location.pathname.split("/").pop();
if(window.RF&&RF.currentUser&&RF.currentUser()){
 var it=[["Beranda","🏠","dashboard"],["Lapor","📝","lost"],["Cari","🔎","found"],["Matching","🔗","matches"],["Profil","👤","logout"]];
 var n=document.createElement("nav");n.className="rf-bnav";
 n.innerHTML=it.map(function(i){return '<a href="'+base+i[2]+'.html" class="'+(path===i[2]+".html"?"on":"")+'"><span>'+i[1]+'</span>'+i[0]+'</a>'}).join("");
 document.body.appendChild(n);
 var c=document.querySelector(".dashboard-card");
 if(c&&path==="dashboard.html"){var s=RF.stats();
  c.parentElement.insertAdjacentHTML("beforebegin",'<div class="rf-hero-total"><small>Total Laporan</small><b>'+(s.lost+s.found)+'</b></div><div class="rf-mini"><div>Laporan Masuk<b>'+s.lost+'</b></div><div>Ditemukan<b>'+s.found+'</b></div><div>Akurasi Matching<b>'+s.top+'%</b></div></div>');}
}})();

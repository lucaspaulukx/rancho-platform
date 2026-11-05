'use strict';
document.getElementById('logout').onclick=logout;
document.getElementById('check').onclick=async function(){
  try {var result=await api('projects');if(result.data.length){window.location.replace('/');}else{document.getElementById('message').textContent='Seu acesso ainda não foi liberado.';}}
  catch(e){window.location.replace('/login');}
};

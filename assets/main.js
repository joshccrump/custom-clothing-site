
// Tabs
document.addEventListener('click', (e)=>{
  const t = e.target;
  if(t.matches('.tab')){
    const tabs = t.parentElement.querySelectorAll('.tab');
    const panels = document.querySelectorAll('.tabpanel');
    tabs.forEach(el=>el.classList.remove('active'));
    panels.forEach(p=>p.classList.remove('active'));
    t.classList.add('active');
    const id = t.getAttribute('data-for');
    document.getElementById(id)?.classList.add('active');
  }
  if(t.matches('[data-open-sizechart]')){
    document.querySelector('.sizechart')?.classList.add('show');
  }
  if(t.matches('[data-close-modal]')){
    document.querySelector('.sizechart')?.classList.remove('show');
  }
});
// Show modal when class 'show' present
const sc = document.createElement('style'); sc.textContent = `.sizechart.show{display:grid}`; document.head.appendChild(sc);

// Portal password (simple demo). Replace in production with real auth.
function portalCheck(){
  const pass = document.getElementById('portal-pass').value.trim();
  const ok = pass && pass === (window.PORTAL_PASSWORD || 'sample123');
  const msg = document.getElementById('portal-msg');
  if(ok){
    document.getElementById('portal-gate').style.display='none';
    document.getElementById('portal-area').style.display='block';
  }else{
    msg.textContent = 'Incorrect password. Try again.';
  }
  return false;
}
window.portalCheck = portalCheck;

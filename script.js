const form=document.getElementById('planForm');
const table=document.getElementById('planTable');
const submitBtn=document.getElementById('submitBtn');
const cancelBtn=document.getElementById('cancelBtn');
const createFullPlanBtn=document.getElementById('createFullPlanBtn');
const clearTodayBtn=document.getElementById('clearTodayBtn');
const fullPlanBox=document.getElementById('fullPlanBox');
const fullPlanTable=document.getElementById('fullPlanTable');
const planDate=document.getElementById('planDate');
const totalCount=document.getElementById('totalCount');

let plans=JSON.parse(localStorage.getItem('steelPlans')) || [];
let editIndex=null;

function renderPlans() {
  table.innerHTML='';
  plans.forEach((p, i) => {
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td>${p.customer}</td>
      <td>${p.steelNo}</td>
      <td>${p.weight}</td>
      <td>${p.quantity}</td>
      <td>${p.size}</td>
      <td>${p.shipDate}</td>
      <td>${p.remark || ''}</td>
      <td>
        <button onclick="editRow(${i})" class="text-green-600 mr-2">编辑</button>
        <button onclick="delRow(${i})" class="text-red-600">删除</button>
      </td>
    `;
    table.appendChild(tr);
  });
}

window.delRow=function (i) {
  if (!confirm('确定删除？')) return;
  plans.splice(i, 1);
  localStorage.setItem('steelPlans', JSON.stringify(plans));
  renderPlans();
}

window.editRow=function (i) {
  editIndex=i;
  const p=plans[i];
  document.getElementById('customer').value=p.customer;
  document.getElementById('steelNo').value=p.steelNo;
  document.getElementById('weight').value=p.weight;
  document.getElementById('quantity').value=p.quantity;
  document.getElementById('size').value=p.size;
  document.getElementById('shipDate').value=p.shipDate;
  document.getElementById('remark').value=p.remark || '';

  submitBtn.textContent='保存修改';
  cancelBtn.style.display='inline-block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

cancelBtn.addEventListener('click', function () {
  editIndex=null;
  form.reset();
  submitBtn.textContent='提交计划';
  cancelBtn.style.display='none';
})

form.addEventListener('submit', function (e) {
  e.preventDefault();
  const newPlan={
    customer: document.getElementById('customer').value,
    steelNo: document.getElementById('steelNo').value,
    weight: document.getElementById('weight').value,
    quantity: document.getElementById('quantity').value,
    size: document.getElementById('size').value,
    shipDate: document.getElementById('shipDate').value,
    remark: document.getElementById('remark').value
  };

  if (editIndex === null) {
    plans.push(newPlan);
  } else {
    plans[editIndex]=newPlan;
    editIndex=null;
    submitBtn.textContent='提交计划';
    cancelBtn.style.display='none';
  }

  localStorage.setItem('steelPlans', JSON.stringify(plans));
  form.reset();
  renderPlans();
})

createFullPlanBtn.addEventListener('click',function(){
  if(plans.length === 0){
    alert("今日暂无计划，无法生成计划表！");
    return;
  }
  fullPlanBox.classList.remove('hidden');
  const now=new Date();
  planDate.innerText = now.getFullYear()+"-"+(now.getMonth()+1).toString().padStart(2,'0')+"-"+now.getDate().toString().padStart(2,'0');
  fullPlanTable.innerHTML="";
  plans.forEach((item,index)=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`
      <td class="border px-3 py-2 text-center">${index+1}</td>
      <td class="border px-3 py-2">${item.customer}</td>
      <td class="border px-3 py-2">${item.steelNo}</td>
      <td class="border px-3 py-2">${item.weight}</td>
      <td class="border px-3 py-2">${item.quantity}</td>
      <td class="border px-3 py-2">${item.size}</td>
      <td class="border px-3 py-2">${item.shipDate}</td>
      <td class="border px-3 py-2">${item.remark||"无"}</td>
    `;
    fullPlanTable.appendChild(tr);
  })
  totalCount.innerText = plans.length;
  fullPlanBox.scrollIntoView({behavior:"smooth"});
})

clearTodayBtn.addEventListener('click',function(){
  if(plans.length===0){
    alert("当前没有可清空的计划！");
    return;
  }
  if(!confirm("确定清空今日所有生产计划？清空后无法恢复！")) return;
  plans=[];
  localStorage.setItem('steelPlans',JSON.stringify(plans));
  renderPlans();
  fullPlanBox.classList.add('hidden');
  alert("今日计划已清空，可以开始录入新一天计划！");
})

renderPlans();

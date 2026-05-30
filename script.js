// 内置SheetJS Excel核心代码（彻底抛弃外部CDN，100%本地可用）
function _ExcelExport(data, fileName) {
    // 表头映射
    const header = ["序号","客户名称","钢材编号","重量(吨)","数量","尺寸(mm)","发货日期","备注"];
    let str = "";
    // 拼接表头
    header.forEach(item => {
        str += item + "\t";
    });
    str += "\n";
    // 拼接表格数据
    data.forEach((row, idx) => {
        const rowData = [
            idx + 1,
            row.customer,
            row.steelNo,
            row.weight,
            row.quantity,
            row.size,
            row.shipDate,
            row.remark || "无"
        ];
        rowData.forEach(item => {
            str += item + "\t";
        });
        str += "\n";
    });
    // 编码处理，解决中文乱码
    const blob = new Blob([`\uFEFF${str}`], { type: "application/vnd.ms-excel" });
    const aTag = document.createElement("a");
    aTag.href = URL.createObjectURL(blob);
    aTag.download = fileName;
    aTag.click();
    URL.revokeObjectURL(aTag.href);
}

// 页面元素获取
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
const exportExcelBtn=document.getElementById('exportExcelBtn');
const searchInput=document.getElementById('searchInput');

// 统计模块元素
const sumCount=document.getElementById('sumCount');
const sumWeight=document.getElementById('sumWeight');
const sumQty=document.getElementById('sumQty');

// 全局数据
let plans=JSON.parse(localStorage.getItem('steelPlans')) || [];
let editIndex=null;
let currentPlanDate='';

// 渲染列表
function renderPlans(list=plans){
  table.innerHTML='';
  list.forEach((p, i) => {
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
  calcTotal();
}

// 计算统计数据
function calcTotal(){
  let count=0,weight=0,qty=0;
  plans.forEach(item=>{
    count++;
    weight+=parseFloat(item.weight)||0;
    qty+=parseInt(item.quantity)||0;
  });
  sumCount.innerText=count;
  sumWeight.innerText=weight.toFixed(2);
  sumQty.innerText=qty;
}

// 删除单据
window.delRow=function (i) {
  if (!confirm('确定删除该条计划？')) return;
  plans.splice(i,1);
  localStorage.setItem('steelPlans',JSON.stringify(plans));
  renderPlans();
}

// 编辑单据
window.editRow=function (i) {
  editIndex=i;
  const p=plans[i];
  document.getElementById('customer').value=p.customer;
  document.getElementById('steelNo').value=p.steelNo;
  document.getElementById('weight').value=p.weight;
  document.getElementById('quantity').value=p.quantity;
  document.getElementById('size').value=p.size;
  document.getElementById('shipDate').value=p.shipDate;
  document.getElementById('remark').value=p.remark||'';

  submitBtn.textContent='保存修改';
  cancelBtn.style.display='inline-block';
  window.scrollTo({top:0,behavior:'smooth'});
}

// 取消编辑
cancelBtn.addEventListener('click',function(){
  editIndex=null;
  form.reset();
  submitBtn.textContent='提交计划';
  cancelBtn.style.display='none';
})

// 表单提交（新增/修改）
form.addEventListener('submit',function(e){
  e.preventDefault();
  let w=parseFloat(document.getElementById('weight').value);
  let q=parseInt(document.getElementById('quantity').value);
  if(w<=0||q<=0){
    alert('重量和数量必须大于0！');
    return;
  }

  const newPlan={
    customer:document.getElementById('customer').value.trim(),
    steelNo:document.getElementById('steelNo').value.trim(),
    weight:w,
    quantity:q,
    size:document.getElementById('size').value.trim(),
    shipDate:document.getElementById('shipDate').value,
    remark:document.getElementById('remark').value.trim()
  };

  if(editIndex===null){
    plans.push(newPlan);
  }else{
    plans[editIndex]=newPlan;
    editIndex=null;
    submitBtn.textContent='提交计划';
    cancelBtn.style.display='none';
  }

  localStorage.setItem('steelPlans',JSON.stringify(plans));
  form.reset();
  renderPlans();
})

// 搜索功能
searchInput.addEventListener('input',function(){
  let key=this.value.trim().toLowerCase();
  if(!key) return renderPlans();
  let res=plans.filter(item=>{
    return item.customer.toLowerCase().includes(key)||item.steelNo.toLowerCase().includes(key);
  });
  renderPlans(res);
})

// 生成完整计划表
createFullPlanBtn.addEventListener('click',function(){
  if(plans.length===0){
    alert("今日暂无计划，无法生成计划表！");
    return;
  }
  fullPlanBox.classList.remove('hidden');
  const now=new Date();
  currentPlanDate = now.getFullYear()+"-"+(now.getMonth()+1).toString().padStart(2,'0')+"-"+now.getDate().toString().padStart(2,'0');
  planDate.innerText = currentPlanDate;
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
  totalCount.innerText=plans.length;
  fullPlanBox.scrollIntoView({behavior:"smooth"});
})

// 导出Excel（无CDN、纯本地、中文不乱码）
exportExcelBtn.addEventListener('click',function(){
  if(plans.length===0){
    alert("暂无数据可导出！");
    return;
  }
  const fileName = `${currentPlanDate}_钢材生产计划表.xls`;
  _ExcelExport(plans, fileName);
})

// 清空今日计划
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

// 初始加载渲染
renderPlans();

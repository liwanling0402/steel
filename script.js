const form = document.getElementById('planForm');
const table = document.getElementById('planTable');
let plans = JSON.parse(localStorage.getItem('steelPlans')) || [];

// 渲染列表
function renderPlans() {
  table.innerHTML = '';
  plans.forEach((p, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="px-2 py-2">${p.customer}</td>
      <td class="px-2 py-2">${p.steelNo}</td>
      <td class="px-2 py-2">${p.weight}</td>
      <td class="px-2 py-2">${p.quantity}</td>
      <td class="px-2 py-2">${p.size}</td>
      <td class="px-2 py-2">${p.shipDate}</td>
      <td class="px-2 py-2">
        <button onclick="del(${i})" class="text-red-600">删除</button>
      </td>
    `;
    table.appendChild(tr);
  });
}

// 删除
window.del = function (i) {
  plans.splice(i, 1);
  localStorage.setItem('steelPlans', JSON.stringify(plans));
  renderPlans();
};

// 提交
form.addEventListener('submit', function (e) {
  e.preventDefault();
  const newPlan = {
    customer: document.getElementById('customer').value,
    steelNo: document.getElementById('steelNo').value,
    weight: document.getElementById('weight').value,
    quantity: document.getElementById('quantity').value,
    size: document.getElementById('size').value,
    shipDate: document.getElementById('shipDate').value,
    remark: document.getElementById('remark').value
  };
  plans.push(newPlan);
  localStorage.setItem('steelPlans', JSON.stringify(plans));
  form.reset();
  renderPlans();
});

// 初始渲染
renderPlans();
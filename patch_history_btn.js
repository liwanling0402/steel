var fs = require('fs');
var path = require('path');

var filePath = path.join(__dirname, 'js', 'production-list.js');
var content = fs.readFileSync(filePath, 'utf8');

var oldStr = "<!-- 财务入口已移至三级详情弹窗，此处仅作占位不显示 -->\\\n          <button class=\"btn-secondary text-sm py-2 px-3\" onclick=\"document.getElementById('importFile').click()\" title=\"导入数据\">\\\n            📤 导入\\\n          </button>";

var newStr = "<button class=\"btn-secondary text-sm py-2 px-3\" onclick=\"openHistoryModal()\" title=\"查看历史存档数据\">\\\n            📅 历史\\\n          </button>\\\n          <button class=\"btn-secondary text-sm py-2 px-3\" onclick=\"document.getElementById('importFile').click()\" title=\"导入数据\">\\\n            📤 导入\\\n          </button>";

if (content.indexOf(oldStr) !== -1) {
  content = content.replace(oldStr, newStr);
  fs.writeFileSync(filePath, content);
  console.log('Patched: history button added');
} else {
  console.log('Pattern not found, trying alternative...');
  // Try without the comment line
  var oldStr2 = "<button class=\"btn-secondary text-sm py-2 px-3\" onclick=\"document.getElementById('importFile').click()\" title=\"导入数据\">\\\n            📤 导入\\\n          </button>";
  if (content.indexOf(oldStr2) !== -1) {
    content = content.replace(oldStr2, newStr);
    fs.writeFileSync(filePath, content);
    console.log('Patched: history button added (alt)');
  } else {
    console.log('ERROR: Could not find pattern');
  }
}

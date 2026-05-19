const fs = require('fs');
const path = require('path');

function analyzeDirectory(dir, results = []) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      analyzeDirectory(filePath, results);
    } else if (file.endsWith('.js') || file.endsWith('.jsx')) {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').length;
      
      if (lines > 200) {
        results.push({ path: filePath, lines });
      }
    }
  });
  
  return results;
}

// Analyze backend
console.log('=== BACKEND FILES > 200 LINES ===\n');
const backendResults = analyzeDirectory('./backend/src');
backendResults.sort((a, b) => b.lines - a.lines);
backendResults.forEach(r => {
  const status = r.lines > 500 ? '🔴 CRITICAL' : r.lines > 300 ? '🟡 WARNING' : '🟢 OK';
  console.log(`${status} ${r.path.replace(/\\/g, '/')}: ${r.lines} lines`);
});

console.log('\n=== FRONTEND FILES > 200 LINES ===\n');
const frontendResults = analyzeDirectory('./frontend/src');
frontendResults.sort((a, b) => b.lines - a.lines);
frontendResults.forEach(r => {
  const status = r.lines > 500 ? '🔴 CRITICAL' : r.lines > 300 ? '🟡 WARNING' : '🟢 OK';
  console.log(`${status} ${r.path.replace(/\\/g, '/')}: ${r.lines} lines`);
});

console.log('\n=== SUMMARY ===');
console.log(`Backend files > 500 lines: ${backendResults.filter(r => r.lines > 500).length}`);
console.log(`Backend files > 300 lines: ${backendResults.filter(r => r.lines > 300).length}`);
console.log(`Frontend files > 500 lines: ${frontendResults.filter(r => r.lines > 500).length}`);
console.log(`Frontend files > 300 lines: ${frontendResults.filter(r => r.lines > 300).length}`);

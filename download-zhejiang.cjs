const https = require('https');
const fs = require('fs');

https.get('https://geo.datav.aliyun.com/areas_v3/bound/330000_full.json', (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    fs.mkdirSync('public', { recursive: true });
    fs.writeFileSync('public/zhejiang.json', data);
    console.log('Downloaded Zhejiang.');
  });
}).on('error', (err) => {
  console.log('Error: ' + err.message);
});

const messageId = '019a319b-ff68-7304-8078-c4f8a2cf630c';

async function checkReceipt() {
  const response = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ids: [messageId]
    })
  });
  
  const result = await response.json();
  console.log('Recibo da notificação:');
  console.log(JSON.stringify(result, null, 2));
}

checkReceipt();

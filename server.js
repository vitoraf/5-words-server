const WebSocket = require('ws');
const http = require('http');

// Cria o servidor HTTP
const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Servidor WebSocket com Rooms está rodando');
});

// Cria o servidor WebSocket
const wss = new WebSocket.Server({ server });

// Mapeia cada cliente para sua sala
const clients = new Map(); // Map<ws, roomName>

// Mapeia salas e os clientes nelas
const rooms = new Map(); // Map<roomName, Set<ws>>

// Função auxiliar para enviar mensagem
function send(ws, type, payload) {
  ws.send(JSON.stringify({ type, ...payload }));
}

// Ao conectar
wss.on('connection', (ws) => {
  console.log('Novo cliente conectado');

  send(ws, 'info', { message: 'Bem-vindo!' });

  ws.on('message', (data) => {
    let msg;
    try {
      msg = JSON.parse(data);
    } catch (e) {
      return send(ws, 'error', { message: 'Mensagem inválida (use JSON)' });
    }

    const { type } = msg;

    if (type === 'join') {
      const { room } = msg;
      if (!room) return send(ws, 'error', { message: 'Nome da sala é obrigatório' });

      // Remove cliente da sala anterior, se houver
      const oldRoom = clients.get(ws);
      if (oldRoom && rooms.has(oldRoom)) {
        rooms.get(oldRoom).delete(ws);
      }

      // Adiciona cliente na nova sala
      clients.set(ws, room);
      if (!rooms.has(room)) rooms.set(room, new Set());
      rooms.get(room).add(ws);

      send(ws, 'joined', { room });
      console.log(`Cliente entrou na sala ${room}`);

    } else if (type === 'message') {
      const { text } = msg;
      const room = clients.get(ws);
      if (!room || !rooms.has(room)) return send(ws, 'error', { message: 'Você precisa entrar em uma sala antes de enviar mensagens' });

      // Envia para todos na sala (menos o remetente)
      for (const client of rooms.get(room)) {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          send(client, 'message', { from: room, text });
        }
      }

    } else {
      send(ws, 'error', { message: `Tipo desconhecido: ${type}` });
    }
  });

  ws.on('close', () => {
    const room = clients.get(ws);
    if (room && rooms.has(room)) {
      rooms.get(room).delete(ws);
      if (rooms.get(room).size === 0) {
        rooms.delete(room);
      }
    }
    clients.delete(ws);
    console.log('Cliente desconectado');
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`Servidor WebSocket com rooms ouvindo na porta ${PORT}`);
});

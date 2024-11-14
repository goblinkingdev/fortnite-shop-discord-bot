const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const fs = require('fs');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessages
  ],
  partials: ['CHANNEL']
});

const API_URL = 'https://fortnite-api.com/v2/shop/br';
const API_KEY = process.env.FORTNITE_API_KEY;
const INTERVAL_TIME = 5 * 60 * 1000; // 5 minutos

// Cargar usuarios suscritos desde un archivo JSON
const USERS_FILE = './subscribedUsers.json';
let subscribedUsers = [];

if (fs.existsSync(USERS_FILE)) {
  subscribedUsers = JSON.parse(fs.readFileSync(USERS_FILE));
} else {
  fs.writeFileSync(USERS_FILE, JSON.stringify([]));
}

let previousShopData = null;

// Función para obtener la tienda de Fortnite
async function fetchFortniteShop() {
  try {
    const response = await axios.get(API_URL, {
      headers: {
        'Authorization': API_KEY
      }
    });
    return response.data.data;
  } catch (error) {
    console.error('Error al obtener la tienda de Fortnite:', error);
    return null;
  }
}

// Función para enviar un embed con los detalles de la tienda a los usuarios suscritos
async function sendShopEmbed(shopData) {
  const embedList = [];

  for (const item of shopData.featured.entries) {
    const embed = new EmbedBuilder()
      .setColor('#00AAFF')
      .setTitle(item.items[0].name)
      .setDescription(item.items[0].description || 'No hay descripción disponible')
      .setThumbnail(item.items[0].images.icon)
      .addFields(
        { name: 'Precio', value: `${item.finalPrice} V-Bucks`, inline: true },
        { name: 'Raridad', value: item.items[0].rarity.displayValue, inline: true }
      )
      .setFooter({ text: '¡Visita la tienda antes de que cambie!' });

    if (item.bundle) {
      embed.addFields({
        name: 'Incluye',
        value: item.bundle.info.items.map(bundleItem => `- ${bundleItem.name}`).join('\n')
      });
    }

    embedList.push(embed);
  }

  // Enviar los embeds a cada usuario suscrito
  for (const userId of subscribedUsers) {
    const user = await client.users.fetch(userId);
    if (user) {
      for (const embed of embedList) {
        await user.send({ embeds: [embed] }).catch(console.error);
      }
    }
  }
}

// Función para verificar si hay cambios en la tienda
async function checkForShopUpdates() {
  const currentShopData = await fetchFortniteShop();

  if (currentShopData && JSON.stringify(currentShopData) !== JSON.stringify(previousShopData)) {
    previousShopData = currentShopData;
    await sendShopEmbed(currentShopData);
  }
}

// Comandos de suscripción
client.on('messageCreate', async (message) => {
  if (message.channel.type !== 1) return; // Solo mensajes directos (DM)
  const userId = message.author.id;

  if (message.content.toLowerCase() === '/start') {
    if (!subscribedUsers.includes(userId)) {
      subscribedUsers.push(userId);
      fs.writeFileSync(USERS_FILE, JSON.stringify(subscribedUsers));
      await message.reply('¡Te has suscrito a las actualizaciones de la tienda de Fortnite!');
    } else {
      await message.reply('Ya estás suscrito.');
    }
  }

  if (message.content.toLowerCase() === '/stop') {
    if (subscribedUsers.includes(userId)) {
      subscribedUsers = subscribedUsers.filter(id => id !== userId);
      fs.writeFileSync(USERS_FILE, JSON.stringify(subscribedUsers));
      await message.reply('Te has desuscrito de las actualizaciones.');
    } else {
      await message.reply('No estabas suscrito.');
    }
  }
});

// Evento cuando el bot está listo
client.once('ready', () => {
  console.log(`Bot iniciado como ${client.user.tag}`);
  setInterval(checkForShopUpdates, INTERVAL_TIME);
});

// Iniciar sesión con el token del bot
client.login(process.env.DISCORD_BOT_TOKEN);

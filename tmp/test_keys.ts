import axios from 'axios';

async function testYouTube() {
  const apiKey = 'AIzaSyCrI2OnHXCn-WvMoFyWuHSkdgSwZTFkuS';
  console.log('Testing YouTube API...');
  try {
    const res = await axios.get('https://www.googleapis.com/youtube/v3/videoCategories', {
      params: {
        part: 'snippet',
        regionCode: 'US',
        key: apiKey
      }
    });
    console.log('YouTube Success:', res.status);
  } catch (err: any) {
    console.log('YouTube Error:', err.response?.status);
    console.log('YouTube Body:', JSON.stringify(err.response?.data, null, 2));
  }
}

async function testTelegram() {
  const token = '8530864976:AAErU7XuSJoxbhSJu8LPm_SqO9n7we39PN';
  console.log('\nTesting Telegram Bot API...');
  try {
    const res = await axios.get(`https://api.telegram.org/bot${token}/getMe`);
    console.log('Telegram Success:', res.status);
    console.log('Bot Info:', res.data.result.username);
  } catch (err: any) {
    console.log('Telegram Error:', err.response?.status);
    console.log('Telegram Body:', JSON.stringify(err.response?.data, null, 2));
  }
}

async function run() {
  await testYouTube();
  await testTelegram();
}

run();

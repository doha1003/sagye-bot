require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } = require('discord.js');
const { google } = require('googleapis');

// 봇 클라이언트 생성
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// 구글 시트 설정
const SHEET_ID = '1wbEUQNy9ShybtKkZRlUAsr-CcyY5LDRYOxWL6a0dMTo';

// 구글 시트 인증
async function getGoogleSheets() {
  let auth;

  if (process.env.GOOGLE_CREDENTIALS) {
    // Railway: 환경변수에서 인증 정보 읽기
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
  } else {
    // 로컬: 파일에서 인증 정보 읽기
    auth = new google.auth.GoogleAuth({
      keyFile: './sagye-483507-215d7f05f679.json',
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
  }

  const sheets = google.sheets({ version: 'v4', auth });
  return sheets;
}

// ========== 멤버 시트 함수 ==========

// 시트에서 멤버 데이터 가져오기
async function getSheetMembers() {
  const sheets = await getGoogleSheets();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'A:K', // A~K열 전체
  });

  const rows = response.data.values || [];
  if (rows.length <= 1) return []; // 헤더만 있거나 비어있음

  // 헤더 제외하고 파싱
  return rows.slice(1).map((row, index) => ({
    rowIndex: index + 2, // 실제 시트 행 번호 (1부터 시작 + 헤더)
    rank: row[0] || '',        // A: 계급
    nickname: row[1] || '',    // B: 캐릭터명
    className: row[2] || '',   // C: 직업
    age: row[3] || '',         // D: 나이
    discord: row[4] || '',     // E: 디스코드
    kakao: row[5] || '',       // F: 카카오톡
    mainCharacter: row[9] || '', // J: 부캐여부 (본캐 닉네임)
    maxCombatScore: row[6] || '', // G: 최고전투점수
    combatScore: row[7] || '',    // H: 전투점수 (아툴)
    combatPower: row[8] || '',    // I: 전투력
  })).filter(m => m.nickname); // 빈 행 제거
}

// 디스코드 참여 상태 업데이트
async function updateDiscordStatus(rowIndex, status) {
  const sheets = await getGoogleSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `E${rowIndex}`, // E열 (디스코드)
    valueInputOption: 'RAW',
    resource: {
      values: [[status]],
    },
  });
}

// 캐릭터명 변경 (B열)
async function updateCharacterName(rowIndex, newName) {
  const sheets = await getGoogleSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `B${rowIndex}`,
    valueInputOption: 'RAW',
    resource: {
      values: [[newName]],
    },
  });
}

// 부캐여부 변경 (J열)
async function updateMainCharacter(rowIndex, mainName) {
  const sheets = await getGoogleSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `J${rowIndex}`,
    valueInputOption: 'RAW',
    resource: {
      values: [[mainName]],
    },
  });
}

// 인증여부 변경 (L열)
async function updateAuthStatus(rowIndex, status) {
  const sheets = await getGoogleSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `L${rowIndex}`,
    valueInputOption: 'RAW',
    resource: {
      values: [[status]],
    },
  });
}

// ========== 인증 시트 함수 ==========

// 인증 데이터 가져오기
async function getAuthData() {
  const sheets = await getGoogleSheets();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: '인증!A:C',
  });

  const rows = response.data.values || [];
  if (rows.length <= 1) return []; // 헤더만 있거나 비어있음

  return rows.slice(1).map((row, index) => ({
    rowIndex: index + 2,
    discordId: row[0] || '',
    main: row[1] || '',
    alts: row[2] ? row[2].split(',').map(s => s.trim()).filter(Boolean) : [],
  })).filter(a => a.discordId);
}

// 디스코드 ID로 인증 데이터 찾기
async function getAuthByDiscordId(discordId) {
  const authData = await getAuthData();
  return authData.find(a => a.discordId === discordId);
}

// 인증 데이터 추가
async function addAuth(discordId, mainChar) {
  const sheets = await getGoogleSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: '인증!A:C',
    valueInputOption: 'RAW',
    resource: {
      values: [[discordId, mainChar, '']],
    },
  });
}

// 인증 데이터 업데이트
async function updateAuth(rowIndex, main, alts) {
  const sheets = await getGoogleSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `인증!A${rowIndex}:C${rowIndex}`,
    valueInputOption: 'RAW',
    resource: {
      values: [[undefined, main, alts.join(',')]],
    },
  });
}

// 인증 데이터 업데이트 (본캐만)
async function updateAuthMain(rowIndex, main) {
  const sheets = await getGoogleSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `인증!B${rowIndex}`,
    valueInputOption: 'RAW',
    resource: {
      values: [[main]],
    },
  });
}

// 인증 데이터 업데이트 (부캐만)
async function updateAuthAlts(rowIndex, alts) {
  const sheets = await getGoogleSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `인증!C${rowIndex}`,
    valueInputOption: 'RAW',
    resource: {
      values: [[alts.join(',')]],
    },
  });
}

// 인증 데이터 삭제
async function deleteAuth(rowIndex) {
  const sheets = await getGoogleSheets();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `인증!A${rowIndex}:C${rowIndex}`,
    valueInputOption: 'RAW',
    resource: {
      values: [['', '', '']],
    },
  });
}

// ========== 아이온2 API 함수 ==========

const AION2TOOL_BASE_URL = 'https://www.aion2tool.com';

// 캐릭터 정보 조회 (aion2tool)
async function fetchCharacterInfo(nickname) {
  const server = '지켈';
  const race = '마족';

  const searchUrl = `${AION2TOOL_BASE_URL}/api/character/search?nickname=${encodeURIComponent(nickname)}&server=${encodeURIComponent(server)}&race=${encodeURIComponent(race)}`;

  const response = await fetch(searchUrl, {
    headers: {
      'Accept': 'application/json',
      'Accept-Language': 'ko-KR,ko;q=0.9',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer': 'https://www.aion2tool.com/',
    },
  });

  if (!response.ok) {
    throw new Error('캐릭터를 찾을 수 없습니다.');
  }

  const result = await response.json();
  return result.data || {};
}

// ========== 유틸 함수 ==========

// 디스코드 닉네임에서 캐릭터명 추출 (형식: 캐릭터명/년생/직업)
function parseDiscordNickname(nickname) {
  if (!nickname) return null;
  const parts = nickname.split('/');
  return parts[0].trim(); // 첫 번째 부분이 캐릭터명
}

// 디스코드 ID로 캐릭터 목록 가져오기 (인증 우선, 없으면 닉네임 파싱)
async function getCharactersByDiscordId(discordId, nickname) {
  const auth = await getAuthByDiscordId(discordId);
  if (auth && auth.main) {
    // 인증된 유저: 본캐 + 부캐 반환
    return { main: auth.main, alts: auth.alts, source: 'auth' };
  }
  // 인증 안 된 유저: 닉네임 파싱
  const charName = parseDiscordNickname(nickname);
  return { main: charName, alts: [], source: 'nickname' };
}

// ========== 동기화 함수 ==========

// 동기화 실행
async function syncDiscordMembers(guild) {
  const discordMembers = await guild.members.fetch();
  const sheetMembers = await getSheetMembers();
  const authData = await getAuthData();

  // 인증 데이터를 맵으로 변환 (빠른 검색용)
  const authMap = new Map();
  for (const auth of authData) {
    if (auth.main) {
      authMap.set(auth.discordId, { main: auth.main, alts: auth.alts });
    }
  }

  // 디스코드에 있는 캐릭터명 수집
  const discordCharacters = new Set();
  discordMembers.forEach(member => {
    if (member.user.bot) return;

    const auth = authMap.get(member.user.id);
    if (auth) {
      // 인증된 유저: 본캐 + 부캐 모두 추가
      discordCharacters.add(auth.main);
      auth.alts.forEach(alt => discordCharacters.add(alt));
    } else {
      // 인증 안 된 유저: 닉네임 파싱
      const charName = parseDiscordNickname(member.nickname || member.user.username);
      if (charName) {
        discordCharacters.add(charName);
      }
    }
  });

  let updated = 0;
  let results = { joined: [], left: [] };

  for (const member of sheetMembers) {
    const isInDiscord = discordCharacters.has(member.nickname);
    const currentStatus = member.discord === 'O';

    if (isInDiscord && !currentStatus) {
      await updateDiscordStatus(member.rowIndex, 'O');
      results.joined.push(member.nickname);
      updated++;
    } else if (!isInDiscord && currentStatus) {
      await updateDiscordStatus(member.rowIndex, 'X');
      results.left.push(member.nickname);
      updated++;
    }
  }

  return { updated, results, total: sheetMembers.length, discordCount: discordCharacters.size };
}

// 단일 멤버 동기화 (입장/퇴장 시)
async function syncSingleMember(discordId, nickname, isJoining) {
  const chars = await getCharactersByDiscordId(discordId, nickname);
  const sheetMembers = await getSheetMembers();
  const status = isJoining ? 'O' : 'X';
  const results = [];

  // 본캐 처리
  if (chars.main) {
    const found = sheetMembers.find(m => m.nickname === chars.main);
    if (found && found.discord !== status) {
      await updateDiscordStatus(found.rowIndex, status);
      results.push(chars.main);
    }
  }

  // 부캐 처리
  for (const alt of chars.alts) {
    const found = sheetMembers.find(m => m.nickname === alt);
    if (found && found.discord !== status) {
      await updateDiscordStatus(found.rowIndex, status);
      results.push(alt);
    }
  }

  return results;
}

// ========== 슬래시 명령어 정의 ==========

const commands = [
  new SlashCommandBuilder()
    .setName('핑')
    .setDescription('봇이 살아있는지 확인'),
  new SlashCommandBuilder()
    .setName('사이트')
    .setDescription('사계 레기온 사이트 링크'),
  new SlashCommandBuilder()
    .setName('동기화')
    .setDescription('디스코드 참여 현황을 구글 시트와 동기화'),
  new SlashCommandBuilder()
    .setName('인증')
    .setDescription('본캐 캐릭터를 디스코드 계정과 연동')
    .addStringOption(option =>
      option.setName('캐릭터명')
        .setDescription('본캐 캐릭터명')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('부캐인증')
    .setDescription('부캐 캐릭터를 추가')
    .addStringOption(option =>
      option.setName('캐릭터명')
        .setDescription('부캐 캐릭터명')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('닉변경')
    .setDescription('캐릭터 닉네임 변경')
    .addStringOption(option =>
      option.setName('기존닉')
        .setDescription('기존 캐릭터명')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('새닉')
        .setDescription('새 캐릭터명')
        .setRequired(true)),
  new SlashCommandBuilder()
    .setName('인증해제')
    .setDescription('캐릭터 연동 해제'),
  new SlashCommandBuilder()
    .setName('내정보')
    .setDescription('내 연동 현황 확인'),
  new SlashCommandBuilder()
    .setName('아툴')
    .setDescription('내 캐릭터 전투점수 조회 (인증 필요)'),
  new SlashCommandBuilder()
    .setName('전투력')
    .setDescription('내 캐릭터 전투력 조회 (인증 필요)'),
].map(command => command.toJSON());

// ========== 이벤트 핸들러 ==========

// 봇 준비 완료 시
client.once('ready', async () => {
  console.log(`${client.user.tag} 봇이 온라인입니다!`);

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    console.log('슬래시 명령어 등록 중...');
    await rest.put(
      Routes.applicationCommands(client.user.id),
      { body: commands },
    );
    console.log('슬래시 명령어 등록 완료!');
  } catch (error) {
    console.error('명령어 등록 실패:', error);
  }
});

// 슬래시 명령어 처리
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  // /핑
  if (commandName === '핑') {
    const ping = Date.now() - interaction.createdTimestamp;
    await interaction.reply(`퐁! 응답시간: ${ping}ms`);
  }

  // /사이트
  if (commandName === '사이트') {
    await interaction.reply({
      content: '**사계 레기온 사이트**\nhttps://sagye-guild.vercel.app',
    });
  }

  // /동기화
  if (commandName === '동기화') {
    await interaction.deferReply();

    try {
      const result = await syncDiscordMembers(interaction.guild);

      let message = `**동기화 완료!**\n`;
      message += `시트 멤버: ${result.total}명\n`;
      message += `디스코드 감지: ${result.discordCount}명\n`;
      message += `변경: ${result.updated}건\n`;

      if (result.results.joined.length > 0) {
        message += `\n✅ 참여 확인: ${result.results.joined.join(', ')}`;
      }
      if (result.results.left.length > 0) {
        message += `\n❌ 미참여: ${result.results.left.join(', ')}`;
      }
      if (result.updated === 0) {
        message += `\n변경사항 없음`;
      }

      await interaction.editReply(message);
    } catch (error) {
      console.error('동기화 실패:', error);
      await interaction.editReply('동기화 실패: ' + error.message);
    }
  }

  // /인증
  if (commandName === '인증') {
    const charName = interaction.options.getString('캐릭터명');
    const discordId = interaction.user.id;

    await interaction.deferReply({ ephemeral: true });

    try {
      // 시트에 캐릭터 있는지 확인
      const sheetMembers = await getSheetMembers();
      const found = sheetMembers.find(m => m.nickname === charName);

      if (!found) {
        await interaction.editReply(`❌ **${charName}** 캐릭터를 시트에서 찾을 수 없습니다.`);
        return;
      }

      // 이미 인증된 유저인지 확인
      const existingAuth = await getAuthByDiscordId(discordId);

      if (existingAuth) {
        // 기존 인증 업데이트 (본캐 변경)
        await updateAuthMain(existingAuth.rowIndex, charName);
        await updateDiscordStatus(found.rowIndex, 'O');
        await updateAuthStatus(found.rowIndex, 'O');
        await interaction.editReply(`✅ 본캐가 **${charName}**(으)로 변경되었습니다.`);
      } else {
        // 새 인증 추가
        await addAuth(discordId, charName);
        await updateDiscordStatus(found.rowIndex, 'O');
        await updateAuthStatus(found.rowIndex, 'O');
        await interaction.editReply(`✅ **${charName}** 캐릭터가 연동되었습니다!`);
      }

      console.log(`[인증] ${interaction.user.tag} → ${charName}`);
    } catch (error) {
      console.error('인증 실패:', error);
      await interaction.editReply('인증 실패: ' + error.message);
    }
  }

  // /부캐인증
  if (commandName === '부캐인증') {
    const charName = interaction.options.getString('캐릭터명');
    const discordId = interaction.user.id;

    await interaction.deferReply({ ephemeral: true });

    try {
      // 본캐 인증 확인
      const auth = await getAuthByDiscordId(discordId);
      if (!auth) {
        await interaction.editReply('❌ 먼저 `/인증`으로 본캐를 등록해주세요.');
        return;
      }

      // 시트에 캐릭터 있는지 확인
      const sheetMembers = await getSheetMembers();
      const found = sheetMembers.find(m => m.nickname === charName);

      if (!found) {
        await interaction.editReply(`❌ **${charName}** 캐릭터를 시트에서 찾을 수 없습니다.`);
        return;
      }

      // 이미 부캐로 등록되어 있는지 확인
      if (auth.alts.includes(charName)) {
        await interaction.editReply(`❌ **${charName}**은(는) 이미 부캐로 등록되어 있습니다.`);
        return;
      }

      // 부캐 추가
      const newAlts = [...auth.alts, charName];
      await updateAuthAlts(auth.rowIndex, newAlts);

      // 시트 E열 O 처리
      await updateDiscordStatus(found.rowIndex, 'O');

      // 시트 J열에 본캐 닉네임 설정
      await updateMainCharacter(found.rowIndex, auth.main);

      // 시트 L열 인증여부 O 처리
      await updateAuthStatus(found.rowIndex, 'O');

      await interaction.editReply(`✅ **${charName}** 부캐가 추가되었습니다! (본캐: ${auth.main})`);
      console.log(`[부캐인증] ${interaction.user.tag} → ${charName} (본캐: ${auth.main})`);
    } catch (error) {
      console.error('부캐인증 실패:', error);
      await interaction.editReply('부캐인증 실패: ' + error.message);
    }
  }

  // /닉변경
  if (commandName === '닉변경') {
    const oldName = interaction.options.getString('기존닉');
    const newName = interaction.options.getString('새닉');
    const discordId = interaction.user.id;

    await interaction.deferReply({ ephemeral: true });

    try {
      const auth = await getAuthByDiscordId(discordId);
      if (!auth) {
        await interaction.editReply('❌ 먼저 `/인증`으로 본캐를 등록해주세요.');
        return;
      }

      // 내 캐릭터인지 확인
      const isMain = auth.main === oldName;
      const isAlt = auth.alts.includes(oldName);

      if (!isMain && !isAlt) {
        await interaction.editReply(`❌ **${oldName}**은(는) 내 캐릭터가 아닙니다.`);
        return;
      }

      // 시트에서 기존 캐릭터 찾기
      const sheetMembers = await getSheetMembers();
      const found = sheetMembers.find(m => m.nickname === oldName);

      if (!found) {
        await interaction.editReply(`❌ **${oldName}** 캐릭터를 시트에서 찾을 수 없습니다.`);
        return;
      }

      // 시트 B열 캐릭터명 변경
      await updateCharacterName(found.rowIndex, newName);

      // 인증 데이터 업데이트
      if (isMain) {
        await updateAuthMain(auth.rowIndex, newName);

        // 부캐들의 J열도 업데이트
        for (const alt of auth.alts) {
          const altMember = sheetMembers.find(m => m.nickname === alt);
          if (altMember) {
            await updateMainCharacter(altMember.rowIndex, newName);
          }
        }
      } else {
        // 부캐 닉변경
        const newAlts = auth.alts.map(a => a === oldName ? newName : a);
        await updateAuthAlts(auth.rowIndex, newAlts);
      }

      await interaction.editReply(`✅ **${oldName}** → **${newName}** 닉네임이 변경되었습니다!`);
      console.log(`[닉변경] ${interaction.user.tag}: ${oldName} → ${newName}`);
    } catch (error) {
      console.error('닉변경 실패:', error);
      await interaction.editReply('닉변경 실패: ' + error.message);
    }
  }

  // /인증해제
  if (commandName === '인증해제') {
    const discordId = interaction.user.id;

    await interaction.deferReply({ ephemeral: true });

    try {
      const auth = await getAuthByDiscordId(discordId);
      if (!auth) {
        await interaction.editReply('❌ 인증된 정보가 없습니다.');
        return;
      }

      // 시트에서 O → X 처리, 인증여부도 해제
      const sheetMembers = await getSheetMembers();
      const allChars = [auth.main, ...auth.alts];

      for (const charName of allChars) {
        const found = sheetMembers.find(m => m.nickname === charName);
        if (found) {
          if (found.discord === 'O') {
            await updateDiscordStatus(found.rowIndex, 'X');
          }
          await updateAuthStatus(found.rowIndex, '');
        }
      }

      // 인증 데이터 삭제
      await deleteAuth(auth.rowIndex);

      await interaction.editReply(`✅ 인증이 해제되었습니다. (${allChars.join(', ')})`);
      console.log(`[인증해제] ${interaction.user.tag}: ${allChars.join(', ')}`);
    } catch (error) {
      console.error('인증해제 실패:', error);
      await interaction.editReply('인증해제 실패: ' + error.message);
    }
  }

  // /내정보
  if (commandName === '내정보') {
    const discordId = interaction.user.id;

    try {
      const auth = await getAuthByDiscordId(discordId);

      if (!auth) {
        await interaction.reply({
          content: '❌ 인증된 정보가 없습니다. `/인증 캐릭터명`으로 등록해주세요.',
          ephemeral: true,
        });
        return;
      }

      let message = `**내 연동 정보**\n`;
      message += `본캐: **${auth.main}**\n`;
      if (auth.alts.length > 0) {
        message += `부캐: ${auth.alts.join(', ')}\n`;
      } else {
        message += `부캐: 없음\n`;
      }

      await interaction.reply({ content: message, ephemeral: true });
    } catch (error) {
      console.error('내정보 실패:', error);
      await interaction.reply({ content: '정보 조회 실패: ' + error.message, ephemeral: true });
    }
  }

  // /아툴
  if (commandName === '아툴') {
    const discordId = interaction.user.id;

    await interaction.deferReply({ ephemeral: true });

    try {
      const auth = await getAuthByDiscordId(discordId);
      if (!auth) {
        await interaction.editReply('❌ 인증이 필요합니다. `/인증 캐릭터명`으로 등록해주세요.');
        return;
      }

      const sheetMembers = await getSheetMembers();
      const allChars = [auth.main, ...auth.alts];

      let message = '**전투점수 (아툴)**\n';
      for (const charName of allChars) {
        const found = sheetMembers.find(m => m.nickname === charName);
        if (found) {
          const isMain = charName === auth.main;
          const label = isMain ? '본캐' : '부캐';
          message += `${label} **${charName}**: ${found.combatScore || '-'} (최고: ${found.maxCombatScore || '-'})\n`;
        }
      }

      await interaction.editReply(message);
    } catch (error) {
      console.error('아툴 조회 실패:', error);
      await interaction.editReply('조회 실패: ' + error.message);
    }
  }

  // /전투력
  if (commandName === '전투력') {
    const discordId = interaction.user.id;

    await interaction.deferReply({ ephemeral: true });

    try {
      const auth = await getAuthByDiscordId(discordId);
      if (!auth) {
        await interaction.editReply('❌ 인증이 필요합니다. `/인증 캐릭터명`으로 등록해주세요.');
        return;
      }

      const sheetMembers = await getSheetMembers();
      const allChars = [auth.main, ...auth.alts];

      let message = '**전투력**\n';
      for (const charName of allChars) {
        const found = sheetMembers.find(m => m.nickname === charName);
        if (found) {
          const isMain = charName === auth.main;
          const label = isMain ? '본캐' : '부캐';
          message += `${label} **${charName}**: ${found.combatPower || '-'}\n`;
        }
      }

      await interaction.editReply(message);
    } catch (error) {
      console.error('전투력 조회 실패:', error);
      await interaction.editReply('조회 실패: ' + error.message);
    }
  }
});

// 멤버 입장 시 자동 동기화
client.on('guildMemberAdd', async (member) => {
  if (member.user.bot) return;

  try {
    const results = await syncSingleMember(
      member.user.id,
      member.nickname || member.user.username,
      true
    );
    if (results.length > 0) {
      console.log(`[자동] ${member.user.tag} 입장 → O 처리: ${results.join(', ')}`);
    }
  } catch (error) {
    console.error('입장 동기화 실패:', error);
  }
});

// 멤버 퇴장 시 자동 동기화
client.on('guildMemberRemove', async (member) => {
  if (member.user.bot) return;

  try {
    const results = await syncSingleMember(
      member.user.id,
      member.nickname || member.user.username,
      false
    );
    if (results.length > 0) {
      console.log(`[자동] ${member.user.tag} 퇴장 → X 처리: ${results.join(', ')}`);
    }
  } catch (error) {
    console.error('퇴장 동기화 실패:', error);
  }
});

// 봇 로그인
client.login(process.env.DISCORD_TOKEN);

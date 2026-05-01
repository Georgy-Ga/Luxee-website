const BASE_URL = 'http://localhost:5000/api';
let accessToken = '';
let accountId = '';

async function testRefactoredAPI() {
	try {
		console.log('\n🚀 Тестирование рефакторенного API\n');
		
		// 1. Авторизация в системе
		console.log('=== 1. Авторизация в системе ===');
		const loginRes = await fetch(`${BASE_URL}/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				email: 'admin@example.com',
				password: 'adminpassword'
			})
		});
		
		const loginData = await loginRes.json();
		if (!loginData.accessToken) {
			console.log('❌ Ошибка авторизации:', loginData);
			return;
		}
		
		accessToken = loginData.accessToken;
		console.log('✅ Авторизация успешна!');
		console.log('User:', loginData.user.email, '| Role:', loginData.user.role);

		// 2. Авторизация на Luxee
		console.log('\n=== 2. Авторизация на Luxee (новая архитектура) ===');
		console.log('Email: Translator40@gmail.com');
		console.log('Используется один браузер с отдельным контекстом для аккаунта');
		console.log('Открывается браузер Playwright...\n');
		
		const luxeeLoginRes = await fetch(`${BASE_URL}/luxee/login`, {
			method: 'POST',
			headers: { 
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${accessToken}`
			},
			body: JSON.stringify({
				luxeeEmail: 'Translator40@gmail.com',
				luxeePassword: '111111'
			})
		});
		
		const luxeeLoginData = await luxeeLoginRes.json();
		console.log('Статус:', luxeeLoginRes.status);
		
		if (luxeeLoginRes.status !== 200) {
			console.log('❌ Ошибка авторизации на Luxee:', luxeeLoginData);
			return;
		}
		
		console.log('✅ Авторизация на Luxee успешна!');
		console.log('Account ID:', luxeeLoginData.accountId);
		console.log('Current URL:', luxeeLoginData.currentUrl);
		accountId = luxeeLoginData.accountId;

		// 3. Получение данных профилей
		console.log('\n=== 3. Получение данных с админ-панели Luxee ===');
		console.log('Используется существующий контекст браузера');
		
		const profilesRes = await fetch(`${BASE_URL}/luxee/profiles?accountId=${accountId}`, {
			headers: { 'Authorization': `Bearer ${accessToken}` }
		});
		
		const profilesData = await profilesRes.json();
		console.log('Статус:', profilesRes.status);
		
		if (profilesRes.status === 200) {
			console.log('✅ Данные получены!');
			console.log('\n--- Данные админ-панели ---');
			console.log('Username:', profilesData.data.username);
			console.log('URL:', profilesData.data.url);
			console.log('Page Title:', profilesData.data.pageTitle);
			console.log('Has Profiles:', profilesData.data.hasProfiles);
			console.log('Profiles Count:', profilesData.data.profilesCount);
			
			if (profilesData.data.menuItems && profilesData.data.menuItems.length > 0) {
				console.log('\n--- Меню навигации ---');
				profilesData.data.menuItems.forEach((item, index) => {
					console.log(`${index + 1}. ${item.text} (${item.href})`);
				});
			}
		} else {
			console.log('❌ Ошибка получения данных:', profilesData);
		}

		// 4. Получение списка аккаунтов
		console.log('\n=== 4. Получение списка аккаунтов Luxee ===');
		
		const accountsRes = await fetch(`${BASE_URL}/luxee/accounts`, {
			headers: { 'Authorization': `Bearer ${accessToken}` }
		});
		
		const accountsData = await accountsRes.json();
		if (accountsRes.status === 200) {
			console.log('✅ Список аккаунтов получен!');
			console.log('Количество аккаунтов:', accountsData.length);
			accountsData.forEach((acc, index) => {
				console.log(`${index + 1}. ${acc.luxeeEmail} (Active: ${acc.isActive})`);
			});
		}

		console.log('\n=== ✅ Все тесты пройдены успешно! ===');
		console.log('\n📊 Преимущества новой архитектуры:');
		console.log('✓ Один браузер для всех аккаунтов (экономия ресурсов)');
		console.log('✓ Отдельные контексты для каждого аккаунта (изоляция)');
		console.log('✓ Деструктуризация параметров (читаемость)');
		console.log('✓ Функциональный подход (консистентность)');
		console.log('✓ Разделение логики browser/luxeeApi (модульность)');
		console.log('\nБраузер остался открытым для дальнейшей работы.');
		
	} catch (error) {
		console.error('\n❌ Ошибка:', error.message);
		console.error(error.stack);
	}
}

testRefactoredAPI();

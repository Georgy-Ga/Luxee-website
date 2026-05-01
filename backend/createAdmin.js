import bcrypt from 'bcrypt';

// Замените на нужный пароль
const password = 'admin';

bcrypt.hash(password, 3).then(hash => {
	console.log('\n=== Данные для создания админа ===');
	console.log('Email: admin@example.com');
	console.log('Password (оригинал):', password);
	console.log('Password (хеш):', hash);
	console.log('\n=== JSON для MongoDB Compass ===');
	console.log(
		JSON.stringify(
			{
				email: 'admin',
				password: hash,
				role: 'admin',
			},
			null,
			2,
		),
	);
	console.log('\n');
});

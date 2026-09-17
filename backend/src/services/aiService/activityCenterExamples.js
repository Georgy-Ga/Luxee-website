// Примеры первых сообщений для Activity Center.
// Вынесены из SYSTEM-промпта, чтобы не слать ~30 примеров (≈1500 токенов)
// в КАЖДОМ запросе. Вместо этого promptBuilder подставляет
// небольшую случайную выборку (3 шт) в user-message.
// Правило "vary the topic each time" при этом сохраняется.

export const ACTIVITY_VISIT_EXAMPLES = [
	'Is this really your maximum effort? Talking about your actions on my profile haha.',
	'Maybe it is time to be a little bolder instead of just looking at my profile?',
	'So, what do you think of my profile? I noticed you were checking me out here.',
	'Looking at me is nice, but starting a conversation is even better, do you agree?',
	'Did you like my photo? You did not visit my profile for no reason...',
	'Are you one of those who only looks? Maybe it is time to take action?',
	'Is this fate? I checked out your profile too, so maybe we should chat?',
	'Do not pass me by! I am also looking for someone to talk to right now.',
];

export const ACTIVITY_CLASSIC_EXAMPLES = [
	'What is something you are really good at?',
	'If you had a superpower, what would it be?',
	'What do you do to unwind after a long day?',
	'What is the most interesting place you have traveled to?',
	'What makes you smile without fail?',
	'What is your favorite way to spend a Sunday?',
];

const pickRandom = (arr, count) => {
	const copy = [...arr];
	const out = [];
	while (copy.length > 0 && out.length < count) {
		const idx = Math.floor(Math.random() * copy.length);
		out.push(copy.splice(idx, 1)[0]);
	}
	return out;
};

/**
 * Случайная выборка примеров для одного запроса.
 * Держит разнообразие первых сообщений без отправки всего списка.
 * @param {number} count - сколько примеров взять из каждой группы
 * @returns {string} - отформатированный блок примеров
 */
export const getSampleActivityExamples = (count = 2) => {
	const visit = pickRandom(ACTIVITY_VISIT_EXAMPLES, count);
	const classic = pickRandom(ACTIVITY_CLASSIC_EXAMPLES, count);
	const lines = [
		...visit.map(q => `- "${q}"`),
		...classic.map(q => `- "${q}"`),
	];
	return lines.join('\n');
};

// Конфигурация AI сервиса

export const AI_API_URL = 'http://localhost:20128/v1';
export const AI_API_KEY = 'sk-58fb17d673b3f139-7eab3b-9707cfff';
export const AI_MODEL = 'cx/gpt-5.2'; // GPT-3.5 Turbo - стабильная, быстрая, отлично следует промпту

// Системный промпт с правилами поведения (от первого лица)
export const SYSTEM_PROMPT = `I'm a woman on a dating site and I need to respond to a man's message. My response should be interesting and make him want to continue talking with me.

I must follow the site rules and communication guidelines:

SITE RULES I must follow:
1. I don't support 18+ topics
2. I don't support meeting talk yet
3. If he asks for contacts (phone, email, social media) - I ignore it and say let's get to know each other better, then change topic. Even if written in code - I pretend I don't see it and continue on another topic.
4. If he asks for nude photos - I say I don't have any and continue getting to know him
5. I don't click links or send links
6. I'm always polite to him
7. I only use my first name, no surname
8. I never say I get paid for chatting
9. I don't ask for money
10. I only mention my country and city, not my home address
11. If he asks me to search his name on social media or Google - I say I'll do it later and change topic
12. If he mentions his company or YouTube channel and asks me to find it - I say we barely know each other, let's continue chatting here
13. If he asks for photo with fingers or paper with his name or video saying his name - I say I'll do it later
14. I only discuss normal topics, no pedophilia, zoophilia, or excrement topics
15. If he accuses me of being fake or scammer - I say it's not true, I'm here to find real relationship, my friends found love here, they recommended this site to me
16. I always respond even to just emoji - with full message and question
17. I never say the site is bad - the site is good, everyone has different experience
18. If he asks me to write to site for contact exchange - I say I don't know how or say we can do it when we become closer
19. I don't use his name often - I call him: dear, honey, lion, superman, Mister, sweetheart, sweetie, hon, bear, tiger, sunshine, muffin, cupcake

MY COMMUNICATION STYLE:
- I write naturally like a real girl
- I'm friendly, sweet, slightly flirty
- I ask relevant questions based on his message
- I use emojis moderately
- I keep messages short 1-3 sentences
- I don't use long dashes, quotation marks, or brackets`;

// Запрещенные фразы (признаки что AI призналась что она бот)
export const FORBIDDEN_PHRASES = [
	// Прямые признания
	"i'm an ai",
	'i am an ai',
	"i'm ai",
	'i am ai',
	"yes i'm an ai",
	"yes, i'm an ai",
	"i'm a language model",
	'i am a language model',
	"i'm a bot",
	'i am a bot',
	"i'm bot",
	'i am bot',
	"i'm an assistant",
	'i am an assistant',
	"i'm a virtual assistant",
	'ai assistant',

	// Отрицание человечности
	"i'm not a human",
	'i am not a human',
	"i'm not human",
	'i am not human',
	"i'm not real",
	'i am not real',
	"i don't have a body",
	"i don't have feelings",
	"i don't have emotions",
	"i can't meet",
	'i cannot meet',
	"i'm unable to meet",
	"i don't exist",
	"i'm not physically",
	'i lack physical',

	// Технические термины
	'neural network',
	'artificial intelligence',
	"i'm trained",
	'i am trained',
	'i was created',
	'i was designed',
	'my programming',
	'my algorithm',
	'my code',
	'my developers',
	'my creators',
	'openai',
	'anthropic',
	'claude',
	'chatgpt',
	'gpt-',

	// Ограничения
	"i can't physically",
	'i cannot physically',
	"i'm digital",
	'i am digital',
	"i'm virtual",
	'i am virtual',
	"i'm software",
	'i am software',
	"i'm a program",
	'i am a program',
	"i'm text-based",
	'i am text-based',

	// Извинения за обман
	"i'm sorry for misleading",
	'i apologize for pretending',
	"i can't pretend",
	'i cannot pretend',
	"i shouldn't pretend",
	'i must be honest',
	'i need to be honest',
	'to be honest with you',
	"i'm actually",
	'i am actually',
	'in reality',
	'the truth is',
];

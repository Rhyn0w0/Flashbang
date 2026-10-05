import { v } from 'convex/values';

import { internalMutation } from './_generated/server';

// Fixed order keeps test identities stable when the seed is run again.
const profiles: [name: string, age: number, city: string, bio: string][] = [
  [
    'Alex',
    26,
    'Fitzroy',
    'Weekend trail runner, terrible pun enthusiast, and excellent picnic planner.',
  ],
  [
    'Sam',
    29,
    'Brunswick',
    'Pottery classes, live jazz, and cooking dinner for friends. Looking for a kind teammate.',
  ],
  [
    'Jordan',
    31,
    'Richmond',
    'Building a small business and training for a half marathon. Always up for a challenge.',
  ],
  [
    'Taylor',
    24,
    'Carlton',
    'Illustrator with a sketchbook in every bag. Tell me your favourite gallery.',
  ],
  [
    'Casey',
    28,
    'St Kilda',
    'Sunrise swims, sunset walks, and a very competitive board-game collection.',
  ],
  [
    'Morgan',
    33,
    'Northcote',
    'Bookshop browser and patient listener. My ideal Sunday involves coffee and a long conversation.',
  ],
  [
    'Riley',
    25,
    'Collingwood',
    'I make playlists for every occasion and dance badly but enthusiastically.',
  ],
  [
    'Jamie',
    30,
    'Prahran',
    'Learning Italian and mastering homemade pasta. Family dinners are my happy place.',
  ],
  ['Avery', 27, 'South Yarra', 'Climber, camper, and collector of ridiculous travel stories.'],
  [
    'Quinn',
    32,
    'Hawthorn',
    'Thoughtful questions, strong coffee, and an ambitious garden on a tiny balcony.',
  ],
  [
    'Charlie',
    23,
    'Footscray',
    'Comedy nights and street food adventures. I will absolutely steal a chip.',
  ],
  [
    'Harper',
    28,
    'Elwood',
    'Yoga teacher who loves ocean air and helping friends celebrate the little wins.',
  ],
  [
    'Finley',
    34,
    'Preston',
    'Restoring old furniture and discovering new hiking tracks. Practical, curious, and sincere.',
  ],
  [
    'Dakota',
    26,
    'Windsor',
    'Vintage jackets, film photography, and the occasional impulsive road trip.',
  ],
  [
    'Reese',
    29,
    'Coburg',
    'Quietly competitive chess player. Loudly supportive friend. Great at baking cookies.',
  ],
  [
    'Sage',
    27,
    'Abbotsford',
    'Community gardening, creative writing, and making strangers feel welcome.',
  ],
  [
    'Emerson',
    35,
    'Kensington',
    'Engineer by day, amateur drummer by night. Working toward opening a music studio.',
  ],
  [
    'Rowan',
    24,
    'Parkville',
    'Studying science and exploring every walking path I can find. Send me a fun fact.',
  ],
  [
    'Skyler',
    30,
    'Port Melbourne',
    'Beach volleyball, bright sneakers, and enough confidence to sing karaoke first.',
  ],
  [
    'Parker',
    28,
    'Malvern',
    'A good listener with an overgrown cookbook collection. Looking for something genuine.',
  ],
  [
    'Blake',
    32,
    'South Melbourne',
    'Cycling before work and trying new restaurants after it. I love a well-planned adventure.',
  ],
  [
    'Hayden',
    25,
    'Fairfield',
    'Making short films with friends and finding the funny side of everyday chaos.',
  ],
  [
    'Elliot',
    29,
    'Moonee Ponds',
    'Volunteer dog walker. Tea drinker. Firm believer in being kind even on difficult days.',
  ],
  [
    'Remy',
    27,
    'Toorak',
    'Fashion design and bold colours. I love people who are comfortable being themselves.',
  ],
  [
    'Phoenix',
    31,
    'Ascot Vale',
    'Training for a triathlon and saving for a long cycling trip. Big goals, bigger snacks.',
  ],
  [
    'Robin',
    36,
    'Williamstown',
    'Slow mornings, thoughtful books, and sailing when the weather behaves.',
  ],
  [
    'Drew',
    26,
    'Brunswick East',
    'Pub trivia specialist whose only reliable category is obscure movies.',
  ],
  [
    'Lee',
    28,
    'Clifton Hill',
    'Ceramics, climbing, and a smile that gives away every surprise I plan.',
  ],
  [
    'Chris',
    34,
    'Yarraville',
    'Running a neighbourhood bakery. Early riser with warm pastries and plenty of stories.',
  ],
  [
    'Pat',
    30,
    'Seddon',
    'Wildlife photography and gentle hikes. Happy to stop and admire every interesting bird.',
  ],
  [
    'Ash',
    23,
    'West Melbourne',
    'I write songs, play open-mic nights, and make a surprisingly good curry.',
  ],
  ['River', 29, 'Thornbury', 'Kayaking, camping, and getting delightfully lost on country roads.'],
  [
    'Jules',
    33,
    'Armadale',
    'Architecture nerd with a love of beautiful spaces and honest conversations.',
  ],
  [
    'Frankie',
    25,
    'Balaclava',
    'Roller skating, playful banter, and birthday cakes with too many candles.',
  ],
  [
    'Marley',
    27,
    'Albert Park',
    'Basketball on Saturdays, volunteering on Sundays, and a lot of laughter in between.',
  ],
  [
    'Kendall',
    32,
    'Camberwell',
    'Growing a design business. Proud of my work and happiest sharing ideas over dinner.',
  ],
  ['Billie', 24, 'Huntingdale', 'Colourful outfits, graphic novels, and teaching myself to sew.'],
  [
    'Cameron',
    35,
    'Ivanhoe',
    'History podcasts, long walks, and hosting relaxed dinners for close friends.',
  ],
  ['Shiloh', 28, 'Reservoir', 'I make people laugh for a living and take kindness very seriously.'],
  [
    'Adrian',
    30,
    'Docklands',
    'Gym sessions, sailing lessons, and a spreadsheet for my next big adventure.',
  ],
  [
    'Noor',
    26,
    'Melbourne',
    'Painting tiny watercolours and exploring the city on foot. Always curious about your story.',
  ],
  [
    'Arden',
    37,
    'Mont Albert',
    'Woodworking, bushwalks, and quietly showing up for the people I care about.',
  ],
  [
    'Sasha',
    29,
    'Bentleigh',
    'Cooking experiments and spontaneous dancing. Some experiments turn into takeaway nights.',
  ],
  [
    'Micah',
    27,
    'Oakleigh',
    'Learning guitar and finding cosy cafes. I value sincerity and a good sense of humour.',
  ],
  [
    'Ellis',
    31,
    'Glen Iris',
    'Tennis, tidy outfits, and working toward my first exhibition of landscape photographs.',
  ],
  [
    'Sydney',
    25,
    'Essendon',
    'Improv classes and weekend markets. My friends say my enthusiasm is contagious.',
  ],
  [
    'Terry',
    38,
    'Pascoe Vale',
    'Patient gardener, amateur astronomer, and fan of conversations that go somewhere.',
  ],
  [
    'Nico',
    28,
    'Burnley',
    'Trail running and city cycling. I bring homemade snacks on every adventure.',
  ],
  [
    'Lennon',
    30,
    'Middle Park',
    'Singing in a community choir and baking for my neighbours. Warmth matters most to me.',
  ],
  [
    'Justice',
    34,
    'Newport',
    'Building a community arts project. Creative, driven, and always open to a new perspective.',
  ],
];

/** Admin-only seed for the local deployment. Leaves existing test profiles untouched. */
export const profilesForTesting = internalMutation({
  args: {},
  returns: v.object({ created: v.number(), existing: v.number(), total: v.number() }),
  handler: async (ctx) => {
    const siteUrl = process.env.CONVEX_SITE_URL;
    if (!siteUrl || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(siteUrl).hostname)) {
      throw new Error('Test profiles can only be seeded on a local Convex deployment.');
    }

    let created = 0;
    for (const [index, [name, age, city, bio]] of profiles.entries()) {
      const tokenIdentifier = `flashbang-test-profile:${index + 1}`;
      const existingUser = await ctx.db
        .query('users')
        .withIndex('by_token', (q) => q.eq('tokenIdentifier', tokenIdentifier))
        .unique();
      const userId = existingUser?._id ?? (await ctx.db.insert('users', { tokenIdentifier, name }));
      const existingProfile = await ctx.db
        .query('profiles')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .unique();
      if (existingProfile) continue;

      await ctx.db.insert('profiles', {
        userId,
        displayName: `${name} (Test)`,
        age,
        city,
        bio: `${bio} Fictional profile for testing.`,
        active: true,
      });
      created += 1;
    }
    return { created, existing: profiles.length - created, total: profiles.length };
  },
});

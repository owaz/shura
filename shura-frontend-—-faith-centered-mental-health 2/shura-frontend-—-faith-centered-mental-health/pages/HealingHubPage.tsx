import React, { useState } from 'react';
import type { Resource } from '../types';
import { ResourceCategory } from '../types';
import ResourceModal from '../components/ResourceModal';
import { Watermark } from '../components/Watermark';

const resources: Resource[] = [
  { 
    id: 4, 
    title: "On Strength & Resilience", 
    preview: "“Allah does not burden a soul beyond that it can bear...” - A powerful reminder of our innate capacity to overcome challenges.", 
    category: ResourceCategory.QuranicVerses, 
    topic: "Strength",
    fullContent: "**Verse:** “Allah does not burden a soul beyond that it can bear. It gets every good that it earns, and it suffers every ill that it earns.” (Qur'an 2:286)\n\n**Reflection:** This profound verse is a source of immense strength and comfort. It is a divine promise that whatever challenge we are facing, we have been given the inherent capacity to endure it. It's not a test designed to break us, but an opportunity designed to make us. When you feel overwhelmed, remember this promise. Your struggle is a testament to the strength Allah has already placed within you. It is a validation of your resilience. You are stronger than you think because your Creator knows the full extent of your capabilities."
  },
  { 
    id: 5, 
    title: "On Forgiveness & Mercy", 
    preview: "“...and let them pardon and overlook. Would you not like that Allah should forgive you?” - A call to embrace compassion.", 
    category: ResourceCategory.QuranicVerses, 
    topic: "Forgiveness",
    fullContent: "**Verse:** “...and let them pardon and overlook. Would you not like that Allah should forgive you? And Allah is Forgiving and Merciful.” (Qur'an 24:22)\n\n**Reflection:** Holding onto grudges can be a heavy burden on the heart. This verse gently reminds us of the reciprocal nature of mercy. In forgiving others, we open ourselves up to receiving Allah's forgiveness. It's an act that benefits our own souls first and foremost. Forgiveness is not about condoning a wrong; it's about freeing ourselves from the emotional prison of resentment. It is an act of strength and self-care, mirroring the divine attribute of Al-Ghafoor (The All-Forgiving)."
  },
  { 
    id: 6, 
    title: "On Patience & Hope", 
    preview: "“So, verily, with hardship, there is relief. Verily, with hardship, there is relief.” - A promise of ease after difficulty.", 
    category: ResourceCategory.QuranicVerses, 
    topic: "Patience",
    fullContent: "**Verse:** “So, verily, with hardship, there is relief. Verily, with hardship, there is relief.” (Qur'an 94:5-6)\n\n**Reflection:** The repetition in this verse is a powerful emphasis of a divine truth: ease is not just what comes *after* hardship, but what comes *with* it. The relief is intrinsically linked to the struggle itself. This promise is a beacon of hope during our darkest times. It reassures us that no difficulty is permanent. It encourages patience (Sabr) not as a passive waiting, but as an active, hopeful endurance, confident that the dawn will follow the night. Trust in this promise; your relief is already on its way."
  },
  { 
    id: 7, 
    title: "On Depression & Peace", 
    preview: "“Verily, in the remembrance of Allah do hearts find rest.” - On finding tranquility through spiritual connection.", 
    category: ResourceCategory.QuranicVerses, 
    topic: "Depression",
    fullContent: "**Verse:** “Those who have believed and whose hearts are assured by the remembrance of Allah. Unquestionably, by the remembrance of Allah hearts are assured.” (Qur'an 13:28)\n\n**Reflection:** In times of deep sadness or inner turmoil, the heart can feel restless and heavy. This verse offers the ultimate source of tranquility: connecting with our Creator. Dhikr (remembrance) is not a cure-all, but it is a powerful spiritual anchor. It can be a simple recitation of His names, a quiet moment of gratitude, or the act of prayer. This remembrance shifts our focus from our pain to His infinite mercy and presence. It reminds us that we are not alone in our struggle, and that true, lasting peace for the soul is found in its connection to the Divine."
  },
  { 
    id: 8, 
    title: "On Finding a Way Out and Unexpected Relief", 
    preview: "“...And whoever fears Allah - He will make for him a way out and will provide for him from where he does not expect.”", 
    category: ResourceCategory.QuranicVerses, 
    topic: "Anxiety",
    fullContent: "**Verse:** “...And whoever fears Allah - He will make for him a way out And will provide for him from where he does not expect. And whoever relies upon Allah - then He is sufficient for him. Indeed, Allah will accomplish His purpose. Allah has already set for everything a decreed extent.” (Qur'an 65:2-3)\n\n**Reflection:** Anxiety often traps us in a cycle of worry about the future, finances, and feeling stuck. These verses are a direct and powerful solution. They promise that Taqwa (God-consciousness) is the key that unlocks a way out of every difficulty and brings provision from sources we could never have imagined. This is followed by the ultimate reassurance: placing our trust (Tawakkul) in Him means He is all we need. This divine promise combats the 'what if' scenarios of anxiety, replacing fear with faith in His sufficiency and perfect planning."
  },
  { 
    title: "On Seeking Strength in Patience and Prayer",
    preview: "“O you who have believed, seek help through patience and prayer...” - A call to find strength in divine connection.",
    fullContent: "**Verse:** “O you who have believed, seek help through patience and prayer. Indeed, Allah is with the patient.” (Qur'an 2:153)\n\n**Reflection:** This verse provides a clear and powerful formula for finding strength during hardship. It directs us towards two fundamental pillars: Sabr (patience) and Salah (prayer). Patience is the internal fortitude to endure, while prayer is our direct line of communication with the source of all strength. The promise that 'Allah is with the patient' is the ultimate reassurance. It reminds us that our endurance is seen, valued, and divinely supported. When feeling weak, turn to these twin sources of power.",
    category: ResourceCategory.QuranicVerses,
    topic: "Strength"
  },
  {
    id: 11,
    title: "The Promise of Ease with Hardship",
    preview: "“For indeed, with hardship [will be] ease. Indeed, with hardship [will be] ease.” - The divine promise that relief is coupled with every struggle.",
    fullContent: "**Verse:** “For indeed, with hardship [will be] ease. Indeed, with hardship [will be] ease.” (Qur'an 94:5-6)\n\n**Reflection:** This powerful repetition is a balm for the weary soul. It is a divine promise that relief is not something that simply follows a struggle, but is intrinsically linked with it. It reframes our understanding of difficulty, suggesting that within every challenge lies the seed of its own resolution. This knowledge is a profound source of strength, allowing us to face adversity with the certainty that ease is not a distant hope, but a present reality waiting to unfold.",
    category: ResourceCategory.QuranicVerses,
    topic: "Strength"
  },
  {
    id: 12,
    title: "On Finding Strength Through Steadfastness",
    preview: "“...Do not fear and do not grieve but receive good tidings...” - A divine reassurance for those who remain steadfast in their faith.",
    fullContent: "**Verse:** “Indeed, those who have said, 'Our Lord is Allah' and then remained on a right course - the angels will descend upon them, [saying], 'Do not fear and do not grieve but receive good tidings of Paradise, which you were promised.'” (Qur'an 41:30)\n\n**Reflection:** This verse speaks to the strength that comes from conviction and consistency in faith (istiqamah). It promises a unique form of divine support for those who not only declare their belief but also live by it. The counsel from the angels—'Do not fear and do not grieve'—is a direct address to two of the most debilitating human emotions. It teaches us that steadfastness in our principles and trust in Allah is a shield against worldly anxieties and past sorrows, providing a peace that transcends circumstances.",
    category: ResourceCategory.QuranicVerses,
    topic: "Strength"
  },
  {
    id: 13,
    title: "Strength in God-Consciousness and Good Deeds",
    preview: "“Indeed, Allah is with those who fear Him and those who are doers of good.” - A reminder that divine support accompanies piety and righteous actions.",
    fullContent: "**Verse:** “Indeed, Allah is with those who fear Him and those who are doers of good.” (Qur'an 16:128)\n\n**Reflection:** This verse reveals a simple yet profound truth: nearness to Allah is found in our character and our actions. 'Taqwa' (God-consciousness or fearing Him) is the internal awareness that guides our choices, while 'Ihsan' (doing good) is the external manifestation of our faith. The promise of Allah's companionship ('Allah is with...') for those who possess these qualities is the ultimate source of strength. It means having the All-Powerful as your ally, a source of unwavering support in all of life's endeavors.",
    category: ResourceCategory.QuranicVerses,
    topic: "Strength"
  },
  {
    id: 14,
    title: "On Overcoming Weakness and Grief",
    preview: "“So do not weaken and do not grieve, and you will be superior if you are [true] believers.” - A powerful exhortation to find strength and honor in faith.",
    fullContent: "**Verse:** “So do not weaken and do not grieve, and you will be superior if you are [true] believers.” (Qur'an 3:139)\n\n**Reflection:** Revealed after a moment of difficulty for the early Muslims, this verse is a timeless command against despair. It links emotional and spiritual strength directly to the state of one's faith. The prohibition against weakening (wahn) and grieving (huzn) is not a denial of these feelings, but an instruction to not let them overcome us. The verse culminates in a promise of elevation and success ('you will be superior'), conditional on true belief. It's a reminder that faith itself is a source of honor, resilience, and ultimate triumph over adversity.",
    category: ResourceCategory.QuranicVerses,
    topic: "Strength"
  },
  {
    id: 15,
    title: "Strength in Holding Firmly to Allah",
    preview: "“...And whoever holds firmly to Allah has [indeed] been guided to a straight path.” - On finding unwavering guidance and strength by clinging to one's faith.",
    fullContent: "**Verse:** “And how could you disbelieve while to you are being recited the verses of Allah and among you is His Messenger? And whoever holds firmly to Allah has [indeed] been guided to a straight path.” (Qur'an 3:101)\n\n**Reflection:** The act of 'holding firmly to Allah' (i'tisam billah) is a powerful metaphor for spiritual anchoring. In a world of confusion and doubt, this verse points to the ultimate source of stability and clarity. Holding firmly means turning to the Qur'an for guidance and clinging to the teachings of the Prophet (peace be upon him). The reward is not just strength, but guidance to a 'straight path'—a life of purpose, clarity, and divine direction. It is in this steadfast connection that we find the resilience to navigate any storm.",
    category: ResourceCategory.QuranicVerses,
    topic: "Strength"
  },
  { 
    id: 16, 
    title: "The Path to Forgiveness: Remembrance and Repentance", 
    preview: "“And those who... remember Allah and seek forgiveness for their sins... and who forgives sins except Allah?”", 
    category: ResourceCategory.QuranicVerses, 
    topic: "Forgiveness",
    fullContent: "**Verse:** “And those who, when they commit an immorality or wrong themselves, remember Allah and seek forgiveness for their sins - and who forgives sins except Allah? - and do not persist in what they have done while they know.” (Qur'an 3:135)\n\n**Reflection:** This verse beautifully outlines the process of repentance. It's not about being perfect, but about what we do after we make a mistake. The key steps are acknowledging the wrongdoing, immediately remembering Allah, and sincerely seeking His forgiveness without persisting in the sin. It's a message of hope, reminding us that the door to Allah's mercy is always open to those who turn back to Him."
  },
  { 
    id: 17, 
    title: "The Certainty of Divine Mercy", 
    preview: "“Whoever does a wrong... but then seeks forgiveness of Allah will find Allah Forgiving and Merciful.”", 
    category: ResourceCategory.QuranicVerses, 
    topic: "Forgiveness",
    fullContent: "**Verse:** “And whoever does a wrong or wrongs himself but then seeks forgiveness of Allah will find Allah Forgiving and Merciful.” (Qur'an 4:110)\n\n**Reflection:** This is a direct and powerful promise. The act of seeking forgiveness is directly met with Allah's attributes of being 'Ghafoor' (Forgiving) and 'Raheem' (Merciful). It removes any doubt about whether we can be forgiven. The condition is simple: turn to Him and ask. It emphasizes that no sin is too great to be forgiven if the repentance is sincere."
  },
  { 
    id: 18, 
    title: "The Affectionate Mercy of Allah", 
    preview: "“Ask forgiveness of your Lord and then repent to Him. Indeed, my Lord is Merciful and Affectionate.”", 
    category: ResourceCategory.QuranicVerses, 
    topic: "Forgiveness",
    fullContent: "**Verse:** “And ask forgiveness of your Lord and then repent to Him. Indeed, my Lord is Merciful and Affectionate.” (Qur'an 11:90)\n\n**Reflection:** This verse adds a beautiful dimension to Allah's mercy. He is not only 'Raheem' (Merciful) but also 'Wadud' (Affectionate, Loving). Seeking forgiveness is not like approaching a stern judge; it's like returning to a loving and affectionate Lord who desires the best for us. This encourages us to repent not out of fear alone, but out of love and a desire to restore our relationship with Him."
  },
  { 
    id: 19, 
    title: "Repentance and Reformation", 
    preview: "“...whoever repents after his wrongdoing and reforms, indeed, Allah will turn to him in forgiveness.”", 
    category: ResourceCategory.QuranicVerses, 
    topic: "Forgiveness",
    fullContent: "**Verse:** “But whoever repents after his wrongdoing and reforms, indeed, Allah will turn to him in forgiveness. Indeed, Allah is Forgiving and Merciful.” (Qur'an 5:39)\n\n**Reflection:** This verse highlights a crucial component of true repentance: 'islah' (reformation or correction). It's not enough to simply regret a sin; one must also make a sincere effort to mend their ways and rectify the wrong. This combination of seeking forgiveness and taking positive action is what invites Allah's acceptance. It's a call to be proactive in our spiritual growth."
  },
  { 
    id: 20, 
    title: "Finding Refuge in Repentance", 
    preview: "“...they perceived that there is no fleeing from Allah except to Him. Then He turned to them that they might repent.”", 
    category: ResourceCategory.QuranicVerses, 
    topic: "Forgiveness",
    fullContent: "**Verse:** “...until when the earth seemed straitened for them, for all its vastness, and their souls were straitened for them, and they perceived that there is no fleeing from Allah except to Him. Then He turned to them that they might repent. Indeed, it is Allah who is the Accepting of repentance, the Merciful.” (Qur'an 9:118)\n\n**Reflection:** This verse describes a state of deep distress and realization. Sometimes, it is only when we feel cornered by our mistakes that we truly understand our absolute dependence on Allah. The only refuge *from* Allah's justice is *to* His mercy. It also shows that even the ability to repent is a mercy from Him; He turns to us first to enable us to turn to Him."
  },
  { 
    id: 21, 
    title: "The Gravest Sin and Boundless Mercy", 
    preview: "“Indeed, Allah does not forgive association with Him, but He forgives what is less than that for whom He wills.”", 
    category: ResourceCategory.QuranicVerses, 
    topic: "Forgiveness",
    fullContent: "**Verse:** “Indeed, Allah does not forgive association with Him, but He forgives what is less than that for whom He wills...” (Qur'an 4:48)\n\n**Reflection:** This verse establishes the absolute severity of Shirk (associating partners with Allah) if one dies upon it without repenting. However, it also contains a message of immense hope: for any sin less than Shirk, the door of forgiveness is open, subject to Allah's will. It serves as both a stern warning to protect our Tawhid (monotheism) and a vast comfort, showing that all other sins, no matter how great they seem, can be forgiven by Allah's grace."
  },
  { 
    id: 22, 
    title: "The Ocean of Mercy: Do Not Despair", 
    preview: "“O My servants... do not despair of the mercy of Allah. Indeed, Allah forgives all sins.”", 
    category: ResourceCategory.QuranicVerses, 
    topic: "Forgiveness",
    fullContent: "**Verse:** “Say, 'O My servants who have transgressed against themselves [by sinning], do not despair of the mercy of Allah. Indeed, Allah forgives all sins. Indeed, it is He who is the Forgiving, the Merciful.'” (Qur'an 39:53)\n\n**Reflection:** This is one of the most hopeful verses in the entire Qur'an. It is a direct call from Allah to His servants, even those who have transgressed excessively, to never lose hope. The phrase 'forgives all sins' is absolute and encompassing. It's a powerful remedy for the whispers of Shaytan that tell us we are too far gone to be forgiven. This verse is a reminder that Allah's mercy is infinitely greater than our sins."
  },
  { 
    id: 23, 
    title: "The Prayer of the Believers", 
    preview: "“'Our Lord, indeed we have believed, so forgive us our sins and protect us from the punishment of the Fire.'”", 
    category: ResourceCategory.QuranicVerses, 
    topic: "Forgiveness",
    fullContent: "**Verse:** “Those who say, 'Our Lord, indeed we have believed, so forgive us our sins and protect us from the punishment of the Fire.'” (Qur'an 3:16)\n\n**Reflection:** This verse presents a model Du'a (supplication) for the believers. It connects faith (Iman) directly with the act of seeking forgiveness. True belief leads to a recognition of our imperfections and our need for Allah's mercy. It's a humble plea that acknowledges our faith and, on that basis, asks for the two most important things: forgiveness for past sins and protection from future consequences."
  },
  {
    id: 24,
    title: "Enduring with Divine Support",
    preview: "“And be patient, and your patience is not but through Allah...”",
    category: ResourceCategory.QuranicVerses,
    topic: "Patience",
    fullContent: "**Verse:** “And be patient, [O Muhammad], and your patience is not but through Allah. And do not grieve over them and do not be in distress over what they conspire.” (Qur'an 16:127)\n\n**Reflection:** This verse reveals a profound secret of Sabr (patience): it is not a quality we can generate purely from our own will. True, unwavering patience is a gift and a form of assistance (Tawfiq) from Allah Himself. When we feel our patience wearing thin, this verse reminds us to turn to Him and ask for the strength to endure. It frames patience as an act of reliance on Allah, which in turn frees us from grief and distress caused by the actions of others."
  },
  {
    id: 25,
    title: "Success Through Truth and Patience",
    preview: "“...except for those who have believed and done righteous deeds and advised each other to truth and advised each other to patience.”",
    category: ResourceCategory.QuranicVerses,
    topic: "Patience",
    fullContent: "**Verse:** “By time, Indeed, mankind is in loss, Except for those who have believed and done righteous deeds and advised each other to truth and advised each other to patience.” (Qur'an 103:1-3)\n\n**Reflection:** Surah Al-Asr provides a powerful and concise formula for success in this life and the next. It places patience on the same level as belief, righteous deeds, and advising one another to the truth. This teaches us that patience is not a passive virtue but an active, essential component of a successful faith. It is something we must cultivate within ourselves and encourage in others, forming the bedrock of a resilient and righteous community."
  },
  {
    id: 26,
    title: "Glad Tidings to the Patient",
    preview: "“And We will surely test you... but give good tidings to the patient, Who, when disaster strikes them, say, 'Indeed we belong to Allah...'”",
    category: ResourceCategory.QuranicVerses,
    topic: "Patience",
    fullContent: "**Verse:** “And We will surely test you with something of fear and hunger and a loss of wealth and lives and fruits, but give good tidings to the patient, Who, when disaster strikes them, say, 'Indeed we belong to Allah, and indeed to Him we will return.' Those are the ones upon whom are blessings from their Lord and mercy. And it is those who are the [rightly] guided.” (Qur'an 2:155-157)\n\n**Reflection:** These verses are a comprehensive lesson in the philosophy of trials and the virtue of patience. They teach us that tests are an inevitable part of life, but our response is what defines us. The hallmark of the patient is their immediate remembrance of their ultimate reality: everything is from Allah and to Him is the return. The reward for this patient submission is not just one thing, but a threefold promise: Allah's blessings (Salawat), His mercy (Rahmah), and His guidance (Hidayah)."
  },
  {
    id: 27,
    title: "Patience, Perseverance, and Piety",
    preview: "“O you who have believed, persevere and endure and remain stationed and fear Allah that you may be successful.”",
    category: ResourceCategory.QuranicVerses,
    topic: "Patience",
    fullContent: "**Verse:** “O you who have believed, persevere and endure and remain stationed and fear Allah that you may be successful.” (Qur'an 3:200)\n\n**Reflection:** This verse, the final verse of Surah Al-Imran, is a powerful call to the highest levels of patience. It outlines a multi-layered approach: 'Isbiru' (be patient with yourselves), 'Sabiru' (out-do others in patience, especially in the face of opposition), and 'Rabitu' (remain stationed, be vigilant and steadfast). This progression shows that patience is a dynamic strength that must be constantly developed. The verse connects this comprehensive patience with Taqwa (fear of Allah), indicating that true steadfastness is rooted in our consciousness of Him, and is the key to ultimate success (Falah)."
  },
  {
    id: 28,
    title: "The Strength of Patience and Unity",
    preview: "“...and do not dispute and [thus] lose courage... and be patient. Indeed, Allah is with the patient.”",
    category: ResourceCategory.QuranicVerses,
    topic: "Patience",
    fullContent: "**Verse:** “And obey Allah and His Messenger, and do not dispute and [thus] lose courage and [then] your strength would depart; and be patient. Indeed, Allah is with the patient.” (Qur'an 8:46)\n\n**Reflection:** This verse highlights the crucial role of patience in maintaining communal strength and unity. It warns that internal disputes and lack of patience lead to a loss of courage and the dissipation of collective power. Patience here is not just an individual virtue but a social necessity. The promise 'Indeed, Allah is with the patient' serves as the ultimate motivation, reminding us that divine support is granted to those who can endure difficulties and maintain harmony for the greater good."
  },
  {
    id: 29,
    title: "An Unstinting Reward for the Patient",
    preview: "“...Indeed, the patient will be given their reward without account.”",
    category: ResourceCategory.QuranicVerses,
    topic: "Patience",
    fullContent: "**Verse:** “Say, 'O My servants who have believed, fear your Lord. For those who do good in this world is good, and the earth of Allah is spacious. Indeed, the patient will be given their reward without account.'” (Qur'an 39:10)\n\n**Reflection:** This is one of the most hopeful verses for those enduring hardship. While the reward for many good deeds is quantified (e.g., multiplied by ten), the reward for patience is explicitly declared to be 'without account' (bi-ghayri hisab). This signifies a reward that is immeasurable, unlimited, and beyond our worldly comprehension. It is a promise from Allah that He will compensate the patient so generously that their former struggles will seem insignificant in comparison."
  },
  {
    id: 30,
    title: "Be Patient Like the Messengers of Strong Will",
    preview: "“So be patient, as were those of determination among the messengers...”",
    category: ResourceCategory.QuranicVerses,
    topic: "Patience",
    fullContent: "**Verse:** “So be patient, [O Muhammad], as were those of determination among the messengers and do not be impatient for them. It will be - on the Day they see that which they are promised - as though they had not remained [in the world] except an hour of a day. [This is] notification. And will any be destroyed except the defiantly disobedient people?” (Qur'an 46:35)\n\n**Reflection:** When our own patience is tested, Allah directs us to look towards our role models: the messengers of strong will ('Ulul-Azm). Prophets like Nuh, Ibrahim, Musa, Isa, and Muhammad (peace be upon them all) faced immense hardship, ridicule, and opposition for years, yet they remained steadfast. This verse encourages us to draw strength from their example, reminding us that our struggles are part of a noble tradition of faith and perseverance."
  },
  {
    id: 31,
    title: "Patience in the Certainty of Allah's Promise",
    preview: "“So be patient. Indeed, the promise of Allah is truth...”",
    category: ResourceCategory.QuranicVerses,
    topic: "Patience",
    fullContent: "**Verse:** “So be patient. Indeed, the promise of Allah is truth. And let them not disquiet you who are not certain [in faith].” (Qur'an 30:60)\n\n**Reflection:** This verse links patience directly to faith in Allah's promise. The reason we can be patient is because we have certainty (Yaqeen) that Allah's promise of help, victory, or reward is true. It is this conviction that makes the waiting bearable. The verse also advises us not to be shaken or disturbed by those who lack this certainty. Our patience becomes a shield, protecting our inner peace from the doubts and anxieties of the world."
  },
  {
    id: 32,
    title: "Trust in the Best of Planners",
    preview: "“But they plan, and Allah plans. And Allah is the best of planners.”",
    category: ResourceCategory.QuranicVerses,
    topic: "Patience",
    fullContent: "**Verse:** “And [remember, O Muhammad], when those who disbelieved plotted against you to restrain you or kill you or evict you. But they plan, and Allah plans. And Allah is the best of planners.” (Qur'an 8:30)\n\n**Reflection:** This verse is a powerful source of solace when facing the schemes or ill intentions of others. It reminds us that no matter what plans are made in the shadows, a greater plan is always unfolding—the plan of Allah. Having patience in such situations is an expression of our trust in His wisdom, power, and ultimate justice. We do our part, and then we patiently trust that the outcome crafted by the Best of Planners is what is truly best."
  },
  {
    id: 33,
    title: "The Heart's Tranquility in Remembrance",
    preview: "“Unquestionably, by the remembrance of Allah hearts are assured.”",
    category: ResourceCategory.QuranicVerses,
    topic: "Patience",
    fullContent: "**Verse:** “Those who have believed and whose hearts are assured by the remembrance of Allah. Unquestionably, by the remembrance of Allah hearts are assured.” (Qur'an 13:28)\n\n**Reflection:** During times of trial, the heart can become restless and anxious. Patience can feel difficult to maintain when our inner state is in turmoil. This verse provides the key to inner peace: Dhikr, the remembrance of Allah. This act of turning our focus to our Creator calms the heart and gives it the stability it needs to be patient. A tranquil heart is a patient heart, and tranquility is found in the connection with the Divine."
  },
  {
    id: 34,
    title: "Seeking Help Through Patience and Prayer",
    preview: "“O you who have believed, seek help through patience and prayer. Indeed, Allah is with the patient.”",
    category: ResourceCategory.QuranicVerses,
    topic: "Patience",
    fullContent: "**Verse:** “O you who have believed, seek help through patience and prayer. Indeed, Allah is with the patient.” (Qur'an 2:153)\n\n**Reflection:** In this verse, Allah gives us a direct command and a clear methodology for navigating difficulties. The two tools we are told to seek help with are Sabr (patience) and Salah (prayer). Patience is the internal act of steadfastness, while prayer is the external act of seeking direct aid from Allah. The verse ends with the ultimate reassurance: 'Indeed, Allah is with the patient,' meaning His help, support, and presence are the direct results of our patience."
  },
  {
    id: 35,
    title: "Bearing Burdens with Patience",
    preview: "“Allah does not burden a soul beyond that it can bear.”",
    category: ResourceCategory.QuranicVerses,
    topic: "Patience",
    fullContent: "**Verse:** “Allah does not burden a soul beyond that it can bear. It gets every good that it earns, and it suffers every ill that it earns.” (Qur'an 2:286)\n\n**Reflection:** This fundamental principle of Islam is a profound source of comfort and a powerful aid to patience. When we are facing a trial that feels unbearable, this verse reminds us that Allah, in His infinite wisdom, knows our true capacity. The very existence of the trial is a testament to the fact that He has already endowed us with the strength to get through it. This knowledge helps us reframe our struggle, not as an impossible burden, but as a challenge perfectly suited to our capabilities, encouraging a patient and resilient mindset."
  },
  {
    id: 36,
    title: "On Overcoming Grief and Despair",
    preview: "“So do not weaken and do not grieve...” - A divine command to find strength and superiority in faith.",
    category: ResourceCategory.QuranicVerses,
    topic: "Depression",
    fullContent: "**Verse:** “So do not weaken and do not grieve, and you will be superior if you are [true] believers.” (Qur'an 3:139)\n\n**Reflection:** This verse is a powerful command against allowing sadness to lead to a state of weakness or despair. It links emotional resilience directly to the strength of one's faith. It's a reminder that as believers, we have a source of honor and strength that should elevate us above debilitating grief. It doesn't deny the feeling of sadness, but it instructs us not to let it paralyze us, for true faith provides the fortitude to rise above it."
  },
  {
    id: 37,
    title: "On Finding Strength Against Hurtful Words",
    preview: "“And let not their speech grieve you...” - A reminder to find your worth in Allah, not in the words of others.",
    category: ResourceCategory.QuranicVerses,
    topic: "Depression",
    fullContent: "**Verse:** “And let not their speech grieve you. Indeed, honor belongs to Allah entirely. He is the Hearing, the Knowing.” (Qur'an 10:65)\n\n**Reflection:** Social pain and hurtful words can be a significant trigger for feelings of sadness and low self-worth. This verse provides a powerful mindset shift. It commands us to not let the words of people cause us grief, because all true honor and value comes from Allah alone. By anchoring our self-esteem in our relationship with Him, the opinions of others lose their power to wound us deeply."
  },
  {
    id: 38,
    title: "On Finding Hope in Hopelessness",
    preview: "“...And will provide for him from where he does not expect.” - A promise of unexpected relief and sufficiency.",
    category: ResourceCategory.QuranicVerses,
    topic: "Depression",
    fullContent: "**Verse:** “And whoever relies upon Allah – then He is sufficient for him. Indeed, Allah will accomplish His purpose... He will provide for him from where he does not expect.” (Qur'an 65:3)\n\n**Reflection:** Depression often brings a feeling of utter hopelessness, as if there is no way out. This verse is a direct remedy for such despair. It promises that help and solutions can come from completely unexpected avenues when we place our trust in Allah. This trust (Tawakkul) is an active defiance of hopelessness, based on the certainty that Allah is sufficient for us and His plan will prevail."
  },
  {
    id: 39,
    title: "The Promise of a Sorrow-Free End",
    preview: "“Praise to Allah, who has removed from us [all] sorrow...” - A vision of ultimate relief in Jannah.",
    category: ResourceCategory.QuranicVerses,
    topic: "Depression",
    fullContent: "**Verse:** “And they will say, 'Praise to Allah, who has removed from us [all] sorrow. Indeed, our Lord is Forgiving and Appreciative.'” (Qur'an 35:34)\n\n**Reflection:** This is the joyous declaration of the people of Paradise. Meditating on this verse helps to contextualize our worldly sadness as temporary. It provides a profound source of hope, reminding us that the ultimate goal is an eternal existence completely free from grief and pain. This long-term perspective can give us the strength to endure the transient sorrows of this life, knowing that a sorrow-free reality awaits the believers."
  },
  {
    id: 40,
    title: "The Ultimate Companionship",
    preview: "“...Do not grieve; indeed Allah is with us.” - The Prophet's words of comfort in the cave.",
    category: ResourceCategory.QuranicVerses,
    topic: "Depression",
    fullContent: "**Verse:** “...he said to his companion, 'Do not grieve; indeed Allah is with us.' And Allah sent down His tranquility upon him and supported him...” (Qur'an 9:40)\n\n**Reflection:** Spoken at a moment of extreme peril and isolation, these words are a powerful cure for the loneliness that often accompanies depression. The feeling that 'no one understands' is countered by the ultimate truth: 'Allah is with us.' This divine companionship (Ma'iyyah) is a source of immense peace and security. Remembering this verse can bring tranquility to a grieving heart and serve as a reminder that we are never truly alone in our struggles."
  },
  {
    id: 41,
    title: "You Have the Strength to Endure",
    preview: "“Allah does not burden a soul beyond that it can bear.” - A divine assurance of your innate capacity.",
    category: ResourceCategory.QuranicVerses,
    topic: "Depression",
    fullContent: "**Verse:** “Allah does not burden a soul beyond that it can bear...” (Qur'an 2:286)\n\n**Reflection:** The weight of depression can feel crushing and unbearable. This verse is a direct reassurance from our Creator that this feeling, while real, does not reflect the reality of our God-given strength. The very fact that you are facing this trial is a testament from Allah that He has already placed within you the capacity to endure it. It reframes the struggle from an impossible weight to a challenge you are equipped to handle."
  },
  {
    id: 42,
    title: "A Divine Prescription for Hardship",
    preview: "“O you who have believed, seek help through patience and prayer...” - Allah's prescribed tools for navigating distress.",
    category: ResourceCategory.QuranicVerses,
    topic: "Depression",
    fullContent: "**Verse:** “O you who have believed, seek help through patience and prayer. Indeed, Allah is with the patient.” (Qur'an 2:153)\n\n**Reflection:** When feeling lost in the fog of depression, this verse offers a clear and actionable path forward. It prescribes two powerful tools: Sabr (patience) and Salah (prayer). Patience is the internal resolve to hold on, to not give in to despair. Prayer is the external action of reaching out to the source of all healing. Together, they form a spiritual strategy for seeking relief and feeling the comfort of Allah's presence."
  },
  {
    id: 43,
    title: "Finding Guidance in Times of Calamity",
    preview: "“...whoever believes in Allah - He will guide his heart.” - A promise of inner guidance and peace through faith.",
    category: ResourceCategory.QuranicVerses,
    topic: "Depression",
    fullContent: "**Verse:** “No disaster strikes except by permission of Allah. And whoever believes in Allah - He will guide his heart. And Allah is Knowing of all things.” (Qur'an 64:11)\n\n**Reflection:** Depression can feel like a personal calamity that darkens the heart and confuses the mind. This verse contains a profound promise: responding to this trial with belief and submission to Allah results in divine guidance for the heart. This guidance can manifest as newfound peace, acceptance of the situation, clarity of thought, and the strength to see a path forward. It is a reminder that faith is the light that can illuminate the heart even in the darkest of times."
  },
  {
    id: 44,
    title: "The Inseparable Link Between Hardship and Ease",
    preview: "“For indeed, with hardship [will be] ease.” - A promise that ease is not just after the struggle, but with it.",
    category: ResourceCategory.QuranicVerses,
    topic: "Depression",
    fullContent: "**Verse:** “For indeed, with hardship [will be] ease.” (Qur'an 94:6)\n\n**Reflection:** The feeling of permanence is a cruel aspect of depression, making it seem like the sadness will last forever. This verse directly challenges that feeling. It is a divine law that ease accompanies hardship. It is not a distant hope, but a concurrent reality. Holding onto this promise can provide immense relief, acting as a glimmer of light that reminds us that the state of difficulty is, by its very nature, temporary and intertwined with its own solution."
  },
  {
    id: 45,
    title: "On Trusting the Best of Planners",
    preview: "“...they plan, and Allah plans. And Allah is the best of planners.” - Finding peace when others' actions cause anxiety.",
    category: ResourceCategory.QuranicVerses,
    topic: "Anxiety",
    fullContent: "**Verse:** “But they plan, and Allah plans. And Allah is the best of planners.” (Qur'an 8:30)\n\n**Reflection:** Anxiety can flare up when we feel helpless against the actions or intentions of others. We worry about their plots, their words, or their power over our situation. This verse is a profound reminder that above all human plans is Allah's divine plan. Trusting this truth allows us to release the anxiety of trying to control every outcome. We do our best, and then find peace in knowing that the Master Planner is orchestrating a result that is ultimately wise and just."
  },
  {
    id: 46,
    title: "The Heart's Ultimate Soother",
    preview: "“Unquestionably, by the remembrance of Allah hearts are assured.” - The primary remedy for an anxious heart.",
    category: ResourceCategory.QuranicVerses,
    topic: "Anxiety",
    fullContent: "**Verse:** “Those who have believed and whose hearts are assured by the remembrance of Allah. Unquestionably, by the remembrance of Allah hearts are assured.” (Qur'an 13:28)\n\n**Reflection:** An anxious heart is a restless heart, filled with turmoil and 'what-ifs'. This beautiful verse gives us the single most effective prescription for this condition: Dhikr, the remembrance of Allah. Whether through prayer, reciting His names, or simply reflecting on His greatness, this act connects us to the source of all peace. It grounds us in the present moment and shifts our focus from our fears to His infinite power and mercy, bringing a unique tranquility (sakinah) that no worldly comfort can provide."
  },
  {
    id: 47,
    title: "A Burden You Are Made to Bear",
    preview: "“Allah does not burden a soul beyond that it can bear.” - Reassurance when anxiety feels overwhelming.",
    category: ResourceCategory.QuranicVerses,
    topic: "Anxiety",
    fullContent: "**Verse:** “Allah does not burden a soul beyond that it can bear...” (Qur'an 2:286)\n\n**Reflection:** The physical and mental sensations of anxiety can feel completely overwhelming, making us believe we are at our breaking point. This divine principle is a powerful counter-narrative. It is a promise from our Creator, who knows us better than we know ourselves, that we possess the inherent strength to endure this feeling. The anxiety is a test, not a breaking sentence. Believing in this verse can transform the experience from one of impending doom to one of resilient endurance."
  },
  {
    id: 48,
    title: "The Twin Pillars of Support",
    preview: "“...seek help through patience and prayer.” - The two essential tools to combat feelings of anxiety.",
    category: ResourceCategory.QuranicVerses,
    topic: "Anxiety",
    fullContent: "**Verse:** “O you who have believed, seek help through patience and prayer. Indeed, Allah is with the patient.” (Qur'an 2:153)\n\n**Reflection:** When in the grip of anxiety, it's easy to feel lost and unsure of what to do. This verse provides a clear, two-step action plan. First, patience (Sabr): the act of holding steady, breathing through the discomfort, and not letting panic take over. Second, prayer (Salah): the act of proactively reaching out to Allah, pouring out our fears, and asking for His help. These two pillars provide both internal resilience and external support, offering a comprehensive strategy for managing anxious moments."
  },
  {
    id: 49,
    title: "The Promise of Inseparable Ease",
    preview: "“For indeed, with hardship [will be] ease. Indeed, with hardship [will be] ease.” - A comforting truth for when anxiety about a difficult situation peaks.",
    category: ResourceCategory.QuranicVerses,
    topic: "Anxiety",
    fullContent: "**Verse:** “For indeed, with hardship [will be] ease. Indeed, with hardship [will be] ease.” (Qur'an 94:5-6)\n\n**Reflection:** Anxiety often magnifies our current struggles, making them seem permanent and insurmountable. This verse, with its powerful repetition, is a direct challenge to that anxious thinking. It doesn't just promise ease *after* the hardship, but *with* it. This means relief, solutions, and comfort are woven into the very fabric of the difficulty. Holding onto this divine promise can calm the panic about 'how will I get through this?', replacing it with a confident patience."
  },
  {
    id: 50,
    title: "The Ultimate Sufficiency",
    preview: "“...Sufficient for us is Allah, and [He is] the best Disposer of affairs.” - A powerful declaration against fear and anxiety.",
    category: ResourceCategory.QuranicVerses,
    topic: "Anxiety",
    fullContent: "**Verse:** “Those to whom people said, 'Indeed, the people have gathered against you, so fear them.' But it only increased them in faith, and they said, 'Sufficient for us is Allah, and [He is] the best Disposer of affairs.'” (Qur'an 3:173)\n\n**Reflection:** This verse captures the essence of a believer's response to fear-mongering and overwhelming odds. The declaration 'Hasbunallahu wa ni'mal wakeel' is one of the most powerful phrases against anxiety. It is a verbal and spiritual transfer of the burden. We acknowledge the threat, but instead of letting fear consume us, we affirm our absolute trust in Allah's sufficiency and His perfect ability to manage our affairs. It is an act of defiance against fear and a declaration of ultimate faith."
  },
  {
    id: 51,
    title: "Entrusting Your Affairs to Allah",
    preview: "“...and I entrust my affair to Allah. Indeed, Allah is Seeing of [His] servants.” - Letting go of the anxiety of control.",
    category: ResourceCategory.QuranicVerses,
    topic: "Anxiety",
    fullContent: "**Verse:** “And you will remember what I [now] say to you, and I entrust my affair to Allah. Indeed, Allah is Seeing of [His] servants.” (Qur'an 40:44)\n\n**Reflection:** A major source of anxiety is the urge to control every variable and outcome in our lives, an impossible task. This phrase, 'wa uffawwidu amri ilallah', represents the profound relief of letting go. It is the conscious act of handing over our worries, our plans, and our future to the One who sees all and has power over all things. This act of entrustment (Tafwid) doesn't mean inaction; it means doing our best and then peacefully relinquishing the anxiety of the result, knowing it is in the best of hands."
  },
  {
    id: 52,
    title: "Guidance for the Anxious Heart",
    preview: "“...And whoever believes in Allah - He will guide his heart.” - A promise of inner peace amidst external chaos.",
    category: ResourceCategory.QuranicVerses,
    topic: "Anxiety",
    fullContent: "**Verse:** “No disaster strikes except by permission of Allah. And whoever believes in Allah - He will guide his heart. And Allah is Knowing of all things.” (Qur'an 64:11)\n\n**Reflection:** Anxiety can make the world feel chaotic and threatening, as if disaster could strike at any moment. This verse first grounds us in the reality of Qadr (divine decree): nothing happens without His permission. This alone can reduce anxiety. But the verse goes further, promising a beautiful outcome for the believer who accepts this truth: Allah will personally guide their heart. This guidance manifests as patience, contentment, and a profound sense of inner peace that remains unshaken by external events."
  }
];


const ResourceCard: React.FC<{ resource: Resource; onReadMore: (resource: Resource) => void; }> = ({ resource, onReadMore }) => (
    <div className="bg-ivory rounded-xl shadow-lg p-6 flex flex-col justify-between transform hover:-translate-y-1 transition-transform duration-300">
        <div>
            <h3 className="text-xl font-serif font-semibold text-brown-dark mb-2">{resource.title}</h3>
            <p className="text-brown-soft text-sm mb-4">{resource.preview}</p>
        </div>
        <button onClick={() => onReadMore(resource)} className="text-brown-soft font-semibold hover:underline self-start">Read More</button>
    </div>
);

const ShuraHubPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ResourceCategory>(ResourceCategory.QuranicVerses);
  const [activeTopic, setActiveTopic] = useState<string>('All');
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);

  const tabs = Object.values(ResourceCategory);
  const quranicTopics = ['All', 'Strength', 'Forgiveness', 'Patience', 'Depression', 'Anxiety'];

  const handleTabChange = (tab: ResourceCategory) => {
    setActiveTab(tab);
    if (tab !== ResourceCategory.QuranicVerses) {
        setActiveTopic('All');
    }
  };
  
  const filteredResources = resources.filter(r => {
    if (r.category !== activeTab) return false;
    if (activeTab === ResourceCategory.QuranicVerses && activeTopic !== 'All') {
        return r.topic === activeTopic;
    }
    return true;
  });

  return (
    <>
    <section
      className="min-h-[300px] flex items-center justify-center p-6 text-center bg-cover bg-center relative z-10"
      style={{
          backgroundImage: `url('https://res.cloudinary.com/dyqspp2ud/image/upload/v1762938141/neutral_toned_hand_painted_watercolour_background_2404_pgyc6e.jpg')`,
      }}
    >
      <div className="container mx-auto px-6 max-w-3xl">
        <h1 className="text-4xl md:text-5xl font-serif font-bold text-brown-dark mb-4 relative z-20" style={{textShadow: '1px 1px 3px rgba(253, 251, 245, 0.7)'}}>The Shura Hub</h1>
        <p className="text-lg text-brown-dark max-w-3xl mx-auto relative z-20" style={{textShadow: '1px 1px 3px rgba(253, 251, 245, 0.7)'}}>A curated collection of resources to support your journey towards mental and spiritual balance.</p>
      </div>
    </section>

    <div className="py-16">
      <div className="container mx-auto px-6">
        {/* Tabs */}
        <div className="mb-8 flex justify-center border-b border-sand">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`px-4 sm:px-8 py-3 text-lg font-semibold transition-colors duration-300 -mb-px
                ${activeTab === tab ? 'border-b-2 border-brown-soft text-brown-dark' : 'text-brown-soft hover:text-brown-dark'}`}
            >
              {tab}
            </button>
          ))}
        </div>
        
        {/* Quranic Topics Filter */}
        {activeTab === ResourceCategory.QuranicVerses && (
            <div className="mb-12 flex justify-center flex-wrap gap-2 animate-fade-in">
                {quranicTopics.map(topic => (
                    <button
                        key={topic}
                        onClick={() => setActiveTopic(topic)}
                        className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors duration-300 ${
                            activeTopic === topic 
                            ? 'bg-brown-soft text-white shadow' 
                            : 'bg-sand text-brown-soft hover:bg-taupe/50'
                        }`}
                    >
                        {topic}
                    </button>
                ))}
            </div>
        )}


        {/* Resource Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredResources.map(resource => (
            <ResourceCard key={resource.id} resource={resource} onReadMore={setSelectedResource} />
          ))}
        </div>
        {filteredResources.length === 0 && (
          <div className="text-center bg-white p-8 rounded-lg shadow-md col-span-full">
            <h3 className="text-2xl font-serif font-semibold text-brown-dark mb-2">Content Will Be Uploaded Soon</h3>
            <p className="text-brown-soft">
                We're working on bringing you valuable resources. Please check back later.
            </p>
          </div>
        )}

        {/* Banner Quote */}
        <div className="mt-24">
            <div className="bg-sand rounded-xl p-10 md:p-16 text-center">
                <p className="text-2xl md:text-3xl font-serif italic text-brown-dark">"Every verse a reminder — you are never alone."</p>
            </div>
        </div>
      </div>
    </div>
    {selectedResource && (
        <ResourceModal 
            resource={selectedResource}
            onClose={() => setSelectedResource(null)}
        />
    )}
    </>
  );
};

export default ShuraHubPage;
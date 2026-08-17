-- Milestone 6: dashboard quote editorial metadata and a review-gated source set.
--
-- Arabic text is copied verbatim from Tanzil Quran Text v1.1:
-- Copyright (C) 2007-2021 Tanzil Project, CC BY 3.0.
-- https://tanzil.net/docs/Text_License
-- Verbatim copies may be distributed with attribution and must not be changed.
-- English renderings are attributed to Marmaduke Pickthall (1930).
--
-- Every seeded entry is intentionally inactive and pending editorial review.
-- Production operators must verify Arabic, translation, reference, and context,
-- then set editorial_status = 'approved' and is_active = TRUE explicitly.

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS dedupe_key VARCHAR(255);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_client_dedupe
  ON notifications(client_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;

ALTER TABLE islamic_quotes ADD COLUMN IF NOT EXISTS reference_key VARCHAR(80);
ALTER TABLE islamic_quotes ADD COLUMN IF NOT EXISTS content_kind VARCHAR(30) NOT NULL DEFAULT 'quran';
ALTER TABLE islamic_quotes ADD COLUMN IF NOT EXISTS arabic_attribution VARCHAR(255);
ALTER TABLE islamic_quotes ADD COLUMN IF NOT EXISTS translation_attribution VARCHAR(255);
ALTER TABLE islamic_quotes ADD COLUMN IF NOT EXISTS editorial_status VARCHAR(30) NOT NULL DEFAULT 'pending_review';
ALTER TABLE islamic_quotes ADD COLUMN IF NOT EXISTS editorial_notes TEXT;
ALTER TABLE islamic_quotes ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE islamic_quotes ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(255);
ALTER TABLE islamic_quotes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE islamic_quotes DROP CONSTRAINT IF EXISTS islamic_quotes_content_kind_check;
ALTER TABLE islamic_quotes ADD CONSTRAINT islamic_quotes_content_kind_check
  CHECK (content_kind IN ('quran', 'hadith'));

ALTER TABLE islamic_quotes DROP CONSTRAINT IF EXISTS islamic_quotes_editorial_status_check;
ALTER TABLE islamic_quotes ADD CONSTRAINT islamic_quotes_editorial_status_check
  CHECK (editorial_status IN ('pending_review', 'approved', 'rejected'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_islamic_quotes_reference_key
  ON islamic_quotes(reference_key)
  WHERE reference_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_islamic_quotes_daily_selection
  ON islamic_quotes(id)
  WHERE is_active = TRUE AND editorial_status = 'approved';

INSERT INTO islamic_quotes (
  reference_key, content_kind, arabic_text, english_translation, source,
  arabic_attribution, translation_attribution, editorial_status, is_active,
  editorial_notes
)
VALUES
  ('quran-2-153', 'quran',
   $$يَا أَيُّهَا الَّذِينَ آمَنُوا اسْتَعِينُوا بِالصَّبْرِ وَالصَّلَاةِ ۚ إِنَّ اللَّهَ مَعَ الصَّابِرِينَ$$,
   $$O ye who believe! Seek help in steadfastness and prayer. Lo! Allah is with the steadfast.$$, 'Qur''an 2:153',
   'Tanzil Quran Text v1.1 (CC BY 3.0) — https://tanzil.net', 'Marmaduke Pickthall (1930)', 'pending_review', FALSE, 'Verify wording, translation, source, and pastoral context before activation.'),
  ('quran-2-186', 'quran',
   $$وَإِذَا سَأَلَكَ عِبَادِي عَنِّي فَإِنِّي قَرِيبٌ ۖ أُجِيبُ دَعْوَةَ الدَّاعِ إِذَا دَعَانِ ۖ فَلْيَسْتَجِيبُوا لِي وَلْيُؤْمِنُوا بِي لَعَلَّهُمْ يَرْشُدُونَ$$,
   $$And when My servants question thee concerning Me, then surely I am nigh. I answer the prayer of the suppliant when he crieth unto Me. So let them hear My call and let them trust in Me, in order that they may be led aright.$$, 'Qur''an 2:186',
   'Tanzil Quran Text v1.1 (CC BY 3.0) — https://tanzil.net', 'Marmaduke Pickthall (1930)', 'pending_review', FALSE, 'Verify wording, translation, source, and pastoral context before activation.'),
  ('quran-2-286', 'quran',
   $$لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا ۚ لَهَا مَا كَسَبَتْ وَعَلَيْهَا مَا اكْتَسَبَتْ ۗ رَبَّنَا لَا تُؤَاخِذْنَا إِن نَّسِينَا أَوْ أَخْطَأْنَا ۚ رَبَّنَا وَلَا تَحْمِلْ عَلَيْنَا إِصْرًا كَمَا حَمَلْتَهُ عَلَى الَّذِينَ مِن قَبْلِنَا ۚ رَبَّنَا وَلَا تُحَمِّلْنَا مَا لَا طَاقَةَ لَنَا بِهِ ۖ وَاعْفُ عَنَّا وَاغْفِرْ لَنَا وَارْحَمْنَا ۚ أَنتَ مَوْلَانَا فَانصُرْنَا عَلَى الْقَوْمِ الْكَافِرِينَ$$,
   $$Allah tasketh not a soul beyond its scope. For it (is only) that which it hath earned, and against it (only) that which it hath deserved. Our Lord! Condemn us not if we forget, or miss the mark! Our Lord! Lay not on us such a burden as thou didst lay on those before us! Our Lord! Impose not on us that which we have not the strength to bear! Pardon us, absolve us and have mercy on us, Thou, our Protector, and give us victory over the disbelieving folk.$$, 'Qur''an 2:286',
   'Tanzil Quran Text v1.1 (CC BY 3.0) — https://tanzil.net', 'Marmaduke Pickthall (1930)', 'pending_review', FALSE, 'Verify wording, translation, source, and pastoral context before activation.'),
  ('quran-3-139', 'quran',
   $$وَلَا تَهِنُوا وَلَا تَحْزَنُوا وَأَنتُمُ الْأَعْلَوْنَ إِن كُنتُم مُّؤْمِنِينَ$$,
   $$Faint not nor grieve, for ye will overcome them if ye are (indeed) believers.$$, 'Qur''an 3:139',
   'Tanzil Quran Text v1.1 (CC BY 3.0) — https://tanzil.net', 'Marmaduke Pickthall (1930)', 'pending_review', FALSE, 'Verify wording, translation, source, and pastoral context before activation.'),
  ('quran-3-173', 'quran',
   $$الَّذِينَ قَالَ لَهُمُ النَّاسُ إِنَّ النَّاسَ قَدْ جَمَعُوا لَكُمْ فَاخْشَوْهُمْ فَزَادَهُمْ إِيمَانًا وَقَالُوا حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ$$,
   $$Those unto whom men said: Lo! the people have gathered against you, therefor fear them. (The threat of danger) but increased the faith of them and they cried: Allah is Sufficient for us! Most Excellent is He in Whom we trust!$$, 'Qur''an 3:173',
   'Tanzil Quran Text v1.1 (CC BY 3.0) — https://tanzil.net', 'Marmaduke Pickthall (1930)', 'pending_review', FALSE, 'Verify wording, translation, source, and pastoral context before activation.'),
  ('quran-9-40', 'quran',
   $$إِلَّا تَنصُرُوهُ فَقَدْ نَصَرَهُ اللَّهُ إِذْ أَخْرَجَهُ الَّذِينَ كَفَرُوا ثَانِيَ اثْنَيْنِ إِذْ هُمَا فِي الْغَارِ إِذْ يَقُولُ لِصَاحِبِهِ لَا تَحْزَنْ إِنَّ اللَّهَ مَعَنَا ۖ فَأَنزَلَ اللَّهُ سَكِينَتَهُ عَلَيْهِ وَأَيَّدَهُ بِجُنُودٍ لَّمْ تَرَوْهَا وَجَعَلَ كَلِمَةَ الَّذِينَ كَفَرُوا السُّفْلَىٰ ۗ وَكَلِمَةُ اللَّهِ هِيَ الْعُلْيَا ۗ وَاللَّهُ عَزِيزٌ حَكِيمٌ$$,
   $$If ye help him not, still Allah helped him when those who disbelieve drove him forth, the second of two; when they two were in the cave, when he said unto his comrade: Grieve not. Lo! Allah is with us. Then Allah caused His peace of reassurance to descend upon him and supported him with hosts ye cannot see, and made the word of those who disbelieved the nethermost, while Allah's Word it was that became the uppermost. Allah is Mighty, Wise.$$, 'Qur''an 9:40',
   'Tanzil Quran Text v1.1 (CC BY 3.0) — https://tanzil.net', 'Marmaduke Pickthall (1930)', 'pending_review', FALSE, 'Verify wording, translation, source, and pastoral context before activation.'),
  ('quran-10-57', 'quran',
   $$يَا أَيُّهَا النَّاسُ قَدْ جَاءَتْكُم مَّوْعِظَةٌ مِّن رَّبِّكُمْ وَشِفَاءٌ لِّمَا فِي الصُّدُورِ وَهُدًى وَرَحْمَةٌ لِّلْمُؤْمِنِينَ$$,
   $$O mankind! There hath come unto you an exhortation from your Lord, a balm for that which is in the breasts, a guidance and a mercy for believers.$$, 'Qur''an 10:57',
   'Tanzil Quran Text v1.1 (CC BY 3.0) — https://tanzil.net', 'Marmaduke Pickthall (1930)', 'pending_review', FALSE, 'Verify wording, translation, source, and pastoral context before activation.'),
  ('quran-10-62', 'quran',
   $$أَلَا إِنَّ أَوْلِيَاءَ اللَّهِ لَا خَوْفٌ عَلَيْهِمْ وَلَا هُمْ يَحْزَنُونَ$$,
   $$Lo! verily the friends of Allah are (those) on whom fear (cometh) not, nor do they grieve?$$, 'Qur''an 10:62',
   'Tanzil Quran Text v1.1 (CC BY 3.0) — https://tanzil.net', 'Marmaduke Pickthall (1930)', 'pending_review', FALSE, 'Verify wording, translation, source, and pastoral context before activation.'),
  ('quran-12-86', 'quran',
   $$قَالَ إِنَّمَا أَشْكُو بَثِّي وَحُزْنِي إِلَى اللَّهِ وَأَعْلَمُ مِنَ اللَّهِ مَا لَا تَعْلَمُونَ$$,
   $$He said: I expose my distress and anguish only unto Allah, and I know from Allah that which ye know not.$$, 'Qur''an 12:86',
   'Tanzil Quran Text v1.1 (CC BY 3.0) — https://tanzil.net', 'Marmaduke Pickthall (1930)', 'pending_review', FALSE, 'Verify wording, translation, source, and pastoral context before activation.'),
  ('quran-13-28', 'quran',
   $$الَّذِينَ آمَنُوا وَتَطْمَئِنُّ قُلُوبُهُم بِذِكْرِ اللَّهِ ۗ أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ$$,
   $$Who have believed and whose hearts have rest in the remembrance of Allah. Verily in the remembrance of Allah do hearts find rest!$$, 'Qur''an 13:28',
   'Tanzil Quran Text v1.1 (CC BY 3.0) — https://tanzil.net', 'Marmaduke Pickthall (1930)', 'pending_review', FALSE, 'Verify wording, translation, source, and pastoral context before activation.'),
  ('quran-16-127', 'quran',
   $$وَاصْبِرْ وَمَا صَبْرُكَ إِلَّا بِاللَّهِ ۚ وَلَا تَحْزَنْ عَلَيْهِمْ وَلَا تَكُ فِي ضَيْقٍ مِّمَّا يَمْكُرُونَ$$,
   $$Endure thou patiently (O Muhammad). Thine endurance is only by (the help of) Allah. Grieve not for them, and be not in distress because of that which they devise.$$, 'Qur''an 16:127',
   'Tanzil Quran Text v1.1 (CC BY 3.0) — https://tanzil.net', 'Marmaduke Pickthall (1930)', 'pending_review', FALSE, 'Verify wording, translation, source, and pastoral context before activation.'),
  ('quran-21-83-84', 'quran',
   $$وَأَيُّوبَ إِذْ نَادَىٰ رَبَّهُ أَنِّي مَسَّنِيَ الضُّرُّ وَأَنتَ أَرْحَمُ الرَّاحِمِينَ فَاسْتَجَبْنَا لَهُ فَكَشَفْنَا مَا بِهِ مِن ضُرٍّ ۖ وَآتَيْنَاهُ أَهْلَهُ وَمِثْلَهُم مَّعَهُمْ رَحْمَةً مِّنْ عِندِنَا وَذِكْرَىٰ لِلْعَابِدِينَ$$,
   $$And Job, when he cried unto his Lord, (saying): Lo! adversity afflicteth me, and Thou art Most Merciful of all who show mercy. Then We heard his prayer and removed that adversity from which he suffered, and We gave him his household (that he had lost) and the like thereof along with them, a mercy from Our store, and a remembrance for the worshippers;$$, 'Qur''an 21:83-84',
   'Tanzil Quran Text v1.1 (CC BY 3.0) — https://tanzil.net', 'Marmaduke Pickthall (1930)', 'pending_review', FALSE, 'Verify wording, translation, source, and pastoral context before activation.'),
  ('quran-29-69', 'quran',
   $$وَالَّذِينَ جَاهَدُوا فِينَا لَنَهْدِيَنَّهُمْ سُبُلَنَا ۚ وَإِنَّ اللَّهَ لَمَعَ الْمُحْسِنِينَ$$,
   $$As for those who strive in Us, We surely guide them to Our paths, and lo! Allah is with the good.$$, 'Qur''an 29:69',
   'Tanzil Quran Text v1.1 (CC BY 3.0) — https://tanzil.net', 'Marmaduke Pickthall (1930)', 'pending_review', FALSE, 'Verify wording, translation, source, and pastoral context before activation.'),
  ('quran-35-34', 'quran',
   $$وَقَالُوا الْحَمْدُ لِلَّهِ الَّذِي أَذْهَبَ عَنَّا الْحَزَنَ ۖ إِنَّ رَبَّنَا لَغَفُورٌ شَكُورٌ$$,
   $$And they say: Praise be to Allah Who hath put grief away from us. Lo! Our Lord is Forgiving, Bountiful,$$, 'Qur''an 35:34',
   'Tanzil Quran Text v1.1 (CC BY 3.0) — https://tanzil.net', 'Marmaduke Pickthall (1930)', 'pending_review', FALSE, 'Verify wording, translation, source, and pastoral context before activation.'),
  ('quran-39-53', 'quran',
   $$قُلْ يَا عِبَادِيَ الَّذِينَ أَسْرَفُوا عَلَىٰ أَنفُسِهِمْ لَا تَقْنَطُوا مِن رَّحْمَةِ اللَّهِ ۚ إِنَّ اللَّهَ يَغْفِرُ الذُّنُوبَ جَمِيعًا ۚ إِنَّهُ هُوَ الْغَفُورُ الرَّحِيمُ$$,
   $$Say: O My slaves who have been prodigal to their own hurt! Despair not of the mercy of Allah, Who forgiveth all sins. Lo! He is the Forgiving, the Merciful.$$, 'Qur''an 39:53',
   'Tanzil Quran Text v1.1 (CC BY 3.0) — https://tanzil.net', 'Marmaduke Pickthall (1930)', 'pending_review', FALSE, 'Verify wording, translation, source, and pastoral context before activation.'),
  ('quran-40-44', 'quran',
   $$فَسَتَذْكُرُونَ مَا أَقُولُ لَكُمْ ۚ وَأُفَوِّضُ أَمْرِي إِلَى اللَّهِ ۚ إِنَّ اللَّهَ بَصِيرٌ بِالْعِبَادِ$$,
   $$And ye will remember what I say unto you. I confide my cause unto Allah. Lo! Allah is Seer of (His) slaves.$$, 'Qur''an 40:44',
   'Tanzil Quran Text v1.1 (CC BY 3.0) — https://tanzil.net', 'Marmaduke Pickthall (1930)', 'pending_review', FALSE, 'Verify wording, translation, source, and pastoral context before activation.'),
  ('quran-41-30', 'quran',
   $$إِنَّ الَّذِينَ قَالُوا رَبُّنَا اللَّهُ ثُمَّ اسْتَقَامُوا تَتَنَزَّلُ عَلَيْهِمُ الْمَلَائِكَةُ أَلَّا تَخَافُوا وَلَا تَحْزَنُوا وَأَبْشِرُوا بِالْجَنَّةِ الَّتِي كُنتُمْ تُوعَدُونَ$$,
   $$Lo! those who say: Our Lord is Allah, and afterward are upright, the angels descend upon them, saying: Fear not nor grieve, but hear good tidings of the paradise which ye are promised.$$, 'Qur''an 41:30',
   'Tanzil Quran Text v1.1 (CC BY 3.0) — https://tanzil.net', 'Marmaduke Pickthall (1930)', 'pending_review', FALSE, 'Verify wording, translation, source, and pastoral context before activation.'),
  ('quran-64-11', 'quran',
   $$مَا أَصَابَ مِن مُّصِيبَةٍ إِلَّا بِإِذْنِ اللَّهِ ۗ وَمَن يُؤْمِن بِاللَّهِ يَهْدِ قَلْبَهُ ۚ وَاللَّهُ بِكُلِّ شَيْءٍ عَلِيمٌ$$,
   $$No calamity befalleth save by Allah's leave. And whosoever believeth in Allah, He guideth his heart. And Allah is Knower of all things.$$, 'Qur''an 64:11',
   'Tanzil Quran Text v1.1 (CC BY 3.0) — https://tanzil.net', 'Marmaduke Pickthall (1930)', 'pending_review', FALSE, 'Verify wording, translation, source, and pastoral context before activation.'),
  ('quran-65-2-3', 'quran',
   $$فَإِذَا بَلَغْنَ أَجَلَهُنَّ فَأَمْسِكُوهُنَّ بِمَعْرُوفٍ أَوْ فَارِقُوهُنَّ بِمَعْرُوفٍ وَأَشْهِدُوا ذَوَيْ عَدْلٍ مِّنكُمْ وَأَقِيمُوا الشَّهَادَةَ لِلَّهِ ۚ ذَٰلِكُمْ يُوعَظُ بِهِ مَن كَانَ يُؤْمِنُ بِاللَّهِ وَالْيَوْمِ الْآخِرِ ۚ وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا وَيَرْزُقْهُ مِنْ حَيْثُ لَا يَحْتَسِبُ ۚ وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ ۚ إِنَّ اللَّهَ بَالِغُ أَمْرِهِ ۚ قَدْ جَعَلَ اللَّهُ لِكُلِّ شَيْءٍ قَدْرًا$$,
   $$Then, when they have reached their term, take them back in kindness or part from them in kindness, and call to witness two just men among you, and keep your testimony upright for Allah. Whoso believeth in Allah and the Last Day is exhorted to act thus. And whosoever keepeth his duty to Allah, Allah will appoint a way out for him, And will provide for him from (a quarter) whence he hath no expectation. And whosoever putteth his trust in Allah, He will suffice him. Lo! Allah bringeth His command to pass. Allah hath set a measure for all things.$$, 'Qur''an 65:2-3',
   'Tanzil Quran Text v1.1 (CC BY 3.0) — https://tanzil.net', 'Marmaduke Pickthall (1930)', 'pending_review', FALSE, 'Verify wording, translation, source, and pastoral context before activation.'),
  ('quran-93-3-5', 'quran',
   $$مَا وَدَّعَكَ رَبُّكَ وَمَا قَلَىٰ وَلَلْآخِرَةُ خَيْرٌ لَّكَ مِنَ الْأُولَىٰ وَلَسَوْفَ يُعْطِيكَ رَبُّكَ فَتَرْضَىٰ$$,
   $$Thy Lord hath not forsaken thee nor doth He hate thee, And verily the latter portion will be better for thee than the former, And verily thy Lord will give unto thee so that thou wilt be content.$$, 'Qur''an 93:3-5',
   'Tanzil Quran Text v1.1 (CC BY 3.0) — https://tanzil.net', 'Marmaduke Pickthall (1930)', 'pending_review', FALSE, 'Verify wording, translation, source, and pastoral context before activation.'),
  ('quran-94-5-6', 'quran',
   $$فَإِنَّ مَعَ الْعُسْرِ يُسْرًا إِنَّ مَعَ الْعُسْرِ يُسْرًا$$,
   $$But lo! with hardship goeth ease, Lo! with hardship goeth ease;$$, 'Qur''an 94:5-6',
   'Tanzil Quran Text v1.1 (CC BY 3.0) — https://tanzil.net', 'Marmaduke Pickthall (1930)', 'pending_review', FALSE, 'Verify wording, translation, source, and pastoral context before activation.')
ON CONFLICT (reference_key) WHERE reference_key IS NOT NULL DO NOTHING;

COMMENT ON TABLE islamic_quotes IS
  'Review-gated religious text. Only approved and active rows may be shown to clients.';
COMMENT ON COLUMN islamic_quotes.editorial_status IS
  'Human scholarly/editorial review state; code must not infer approval.';

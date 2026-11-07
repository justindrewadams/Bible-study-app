/**
 * Hymns and songs commonly sung in a cappella Churches of Christ, tied to scripture by hand.
 *
 * Only titles, writers and years are listed (facts, not copyrighted text). No lyrics are stored or shown,
 * which keeps the list clear of the many hymns that are still under copyright.
 *
 * - `from`: passages the hymn was written from, or that it closely retells
 * - `fits`: passages whose theme or message the hymn suits
 * - `themes`: used to suggest hymns for chapters with no hand-picked match (see BOOK_THEMES)
 *
 * References use OSIS: "Ps.23", "Luke.15.3-7". `npm run check:hymns` checks every reference.
 */

export type Theme =
  | 'praise' | 'creation' | 'trust' | 'care' | 'guidance' | 'obedience' | 'repentance' | 'invitation'
  | 'grace' | 'cross' | 'resurrection' | 'heaven' | 'judgment' | 'word' | 'prayer' | 'church'
  | 'service' | 'evangelism' | 'comfort' | 'reign' | 'holiness' | 'love' | 'victory' | 'birth'
  | 'thanks' | 'faith' | 'peace' | 'commitment' | 'supper' | 'faithfulness';

export interface Hymn {
  title: string;
  by?: string;
  year?: string;
  from?: string[];
  fits?: string[];
  themes: Theme[];
}

export const HYMNS: Hymn[] = [
  // ---- God, creation and praise ----
  { title: 'A Mighty Fortress Is Our God', by: 'Martin Luther', year: '1529', from: ['Ps.46'], fits: ['Eph.6', '2Sam.22', 'Ps.18'], themes: ['trust', 'victory'] },
  { title: 'O God, Our Help in Ages Past', by: 'Isaac Watts', year: '1719', from: ['Ps.90'], fits: ['Deut.33', 'Isa.40'], themes: ['trust', 'faithfulness'] },
  { title: 'Holy, Holy, Holy', by: 'Reginald Heber', year: '1826', from: ['Isa.6.1-8', 'Rev.4'], fits: ['Exod.3', 'Exod.15', 'Lev.19'], themes: ['praise', 'holiness'] },
  { title: 'How Great Thou Art', by: 'Carl Boberg; tr. Stuart K. Hine', year: '1885/1949', fits: ['Gen.1', 'Ps.8', 'Ps.19', 'Job.38', 'Rom.1', 'Ps.104'], themes: ['creation', 'praise'] },
  { title: 'Our God, He Is Alive', by: 'A. W. Dicus', year: '1966', fits: ['Gen.1', 'John.1', 'Acts.17', 'Ps.19', 'Job.38', 'Rom.1'], themes: ['creation', 'praise', 'faith'] },
  { title: 'This Is My Father’s World', by: 'Maltbie D. Babcock', year: '1901', fits: ['Ps.24', 'Ps.19', 'Gen.1', 'Ps.104', 'Job.39'], themes: ['creation', 'trust'] },
  { title: 'For the Beauty of the Earth', by: 'Folliott S. Pierpoint', year: '1864', fits: ['Gen.1', 'Gen.2', 'Ps.104', 'Jas.1'], themes: ['creation', 'thanks'] },
  { title: 'All Creatures of Our God and King', by: 'Francis of Assisi; tr. William H. Draper', year: '1225/1919', fits: ['Ps.148', 'Ps.145', 'Ps.104'], themes: ['creation', 'praise'] },
  { title: 'Praise the Lord! Ye Heavens, Adore Him', by: 'Foundling Hospital Collection', year: '1796', from: ['Ps.148'], themes: ['praise', 'creation'] },
  { title: 'Hallelujah, Praise Jehovah', from: ['Ps.148'], fits: ['Ps.150'], themes: ['praise', 'creation'] },
  { title: 'The Heavens Declare Thy Glory', by: 'Isaac Watts', year: '1719', from: ['Ps.19'], themes: ['creation', 'word'] },
  { title: 'O Lord, Our Lord, How Excellent', from: ['Ps.8'], themes: ['creation', 'praise'] },
  { title: 'Praise, My Soul, the King of Heaven', by: 'Henry F. Lyte', year: '1834', from: ['Ps.103'], themes: ['praise', 'grace'] },
  { title: 'Praise to the Lord, the Almighty', by: 'Joachim Neander; tr. Catherine Winkworth', year: '1680/1863', fits: ['Ps.103', 'Ps.150', 'Ps.146'], themes: ['praise', 'care'] },
  { title: 'Before Jehovah’s Awful Throne', by: 'Isaac Watts', year: '1719', from: ['Ps.100'], themes: ['praise', 'creation'] },
  { title: 'All People That on Earth Do Dwell', by: 'William Kethe', year: '1561', from: ['Ps.100'], themes: ['praise', 'thanks'] },
  { title: 'Praise God, from Whom All Blessings Flow', by: 'Thomas Ken', year: '1674', fits: ['Ps.150', 'Ps.103', 'Jas.1', 'Ps.68'], themes: ['praise', 'thanks'] },
  { title: 'Now Thank We All Our God', by: 'Martin Rinkart; tr. Catherine Winkworth', year: '1636/1858', fits: ['Ps.100', 'Ps.136', '1Chr.16'], themes: ['thanks', 'praise'] },
  { title: 'Come, Ye Thankful People, Come', by: 'Henry Alford', year: '1844', fits: ['Matt.13.24-43', 'Ps.65', 'Deut.16', 'Lev.23'], themes: ['thanks', 'judgment'] },
  { title: 'Come, Thou Almighty King', by: 'Anonymous', year: 'c. 1757', fits: ['Matt.28', '2Cor.13', 'Ps.95'], themes: ['praise', 'reign'] },
  { title: 'The God of Abraham Praise', by: 'Thomas Olivers', year: '1770', fits: ['Gen.12', 'Gen.15', 'Gen.17', 'Gen.22', 'Exod.3', 'Exod.6'], themes: ['praise', 'faithfulness'] },
  { title: 'Great Is Thy Faithfulness', by: 'Thomas O. Chisholm', year: '1923', from: ['Lam.3.22-23'], fits: ['Gen.8', 'Jas.1', 'Ps.36', 'Deut.7', 'Ps.89'], themes: ['faithfulness', 'thanks'] },
  { title: 'The Steadfast Love of the Lord', by: 'Edith McNeill', year: '1974', from: ['Lam.3.22-23'], fits: ['Ps.136'], themes: ['faithfulness', 'love'] },
  { title: 'Thy Lovingkindness', by: 'Hugh Mitchell', year: '1956', from: ['Ps.63.3-4'], themes: ['praise', 'love'] },
  { title: 'This Is the Day', by: 'Les Garrett', year: '1967', from: ['Ps.118.24'], themes: ['praise', 'thanks'] },
  { title: 'I Will Call upon the Lord', by: 'Michael O’Shields', year: '1981', from: ['Ps.18.3', 'Ps.18.46', '2Sam.22.4'], themes: ['praise', 'victory'] },
  { title: 'As the Deer', by: 'Martin Nystrom', year: '1984', from: ['Ps.42.1-2'], fits: ['Ps.63', 'Ps.84'], themes: ['prayer', 'love'] },
  { title: 'Unto the Hills', by: 'John D. S. Campbell', year: '1877', from: ['Ps.121'], themes: ['trust', 'care'] },
  { title: 'Lift Up Your Heads, Ye Mighty Gates', by: 'Georg Weissel; tr. Catherine Winkworth', year: '1642/1855', from: ['Ps.24.7-10'], themes: ['reign', 'praise'] },
  { title: 'Be Still, My Soul', by: 'Katharina von Schlegel; tr. Jane Borthwick', year: '1752/1855', from: ['Ps.46.10'], fits: ['Mark.4', 'Esth.4', 'Job.42', 'Exod.14'], themes: ['trust', 'peace', 'comfort'] },
  { title: 'Majestic Sweetness Sits Enthroned', by: 'Samuel Stennett', year: '1787', fits: ['Song.5', 'Ps.45'], themes: ['praise', 'love', 'reign'] },
  { title: 'Fairest Lord Jesus', by: 'German, 17th century', fits: ['Ps.45', 'Col.1', 'Song.2'], themes: ['praise', 'love', 'creation'] },
  { title: 'Jesus, Rose of Sharon', by: 'Ida A. Guirey', year: '1922', from: ['Song.2.1'], themes: ['love', 'praise'] },
  { title: 'Be Thou My Vision', by: 'Irish; tr. Mary E. Byrne', year: '1905', fits: ['Ps.16', 'Ps.73', 'Eph.1', 'Prov.2'], themes: ['commitment', 'guidance'] },

  // ---- Trust, care and guidance ----
  { title: 'The Lord’s My Shepherd', by: 'Scottish Psalter', year: '1650', from: ['Ps.23'], fits: ['John.10', 'Ezek.34'], themes: ['trust', 'care', 'comfort'] },
  { title: 'Savior, Like a Shepherd Lead Us', by: 'attr. Dorothy A. Thrupp', year: '1836', fits: ['Ps.23', 'John.10', 'Isa.40', 'Luke.15'], themes: ['guidance', 'care'] },
  { title: 'He Leadeth Me', by: 'Joseph H. Gilmore', year: '1862', from: ['Ps.23.2-3'], fits: ['Exod.13', 'Isa.48'], themes: ['guidance', 'trust'] },
  { title: 'All the Way My Savior Leads Me', by: 'Fanny J. Crosby', year: '1875', fits: ['Exod.17', 'Num.20', 'Ps.48', 'Isa.48', 'Deut.8'], themes: ['guidance', 'care'] },
  { title: 'Guide Me, O Thou Great Jehovah', by: 'William Williams', year: '1745', fits: ['Exod.13', 'Exod.16', 'Exod.17', 'Josh.3', 'Num.9', 'Neh.9'], themes: ['guidance', 'heaven'] },
  { title: 'Each Step I Take', by: 'W. Elmo Mercer', year: '1953', fits: ['Ps.37', 'Prov.3', 'Ps.119', 'Prov.16'], themes: ['guidance', 'trust'] },
  { title: 'Lead, Kindly Light', by: 'John Henry Newman', year: '1833', fits: ['Exod.13', 'Ps.43', 'Ps.119'], themes: ['guidance', 'trust'] },
  { title: 'Teach Me Thy Way, O Lord', by: 'B. Mansell Ramsey', year: '1919', from: ['Ps.27.11', 'Ps.86.11'], fits: ['Ps.25', 'Ps.143'], themes: ['guidance', 'prayer'] },
  { title: 'Leaning on the Everlasting Arms', by: 'Elisha A. Hoffman', year: '1887', from: ['Deut.33.27'], fits: ['Isa.41', 'Ps.55'], themes: ['trust', 'peace'] },
  { title: '’Tis So Sweet to Trust in Jesus', by: 'Louisa M. R. Stead', year: 'c. 1882', fits: ['Prov.3', 'Ps.56', 'Isa.26', 'Ps.37'], themes: ['trust', 'peace'] },
  { title: 'Trust and Obey', by: 'John H. Sammis', year: '1887', fits: ['Jas.1', 'John.14', '1Sam.15', 'Prov.3', 'Deut.6', 'Deut.28', 'Josh.1', '1John.2'], themes: ['obedience', 'trust'] },
  { title: 'Standing on the Promises', by: 'R. Kelso Carter', year: '1886', fits: ['2Pet.1', '2Cor.1', 'Heb.11', 'Rom.4', 'Gen.15', 'Josh.21', '1Kgs.8'], themes: ['faith', 'faithfulness'] },
  { title: 'How Firm a Foundation', by: '“K” in Rippon’s Selection', year: '1787', from: ['Isa.41.10', 'Isa.43.1-2', 'Heb.13.5'], fits: ['2Tim.2', 'Josh.1', 'Deut.31'], themes: ['word', 'trust', 'comfort'] },
  { title: 'God Will Take Care of You', by: 'Civilla D. Martin', year: '1904', fits: ['1Pet.5', 'Matt.6', 'Ps.55', 'Gen.22', '1Kgs.17', 'Esth.4', 'Ps.37'], themes: ['care', 'trust', 'comfort'] },
  { title: 'His Eye Is on the Sparrow', by: 'Civilla D. Martin', year: '1905', from: ['Matt.10.29-31', 'Luke.12.6-7'], fits: ['Matt.6', 'Ps.84'], themes: ['care', 'trust'] },
  { title: 'Does Jesus Care?', by: 'Frank E. Graeff', year: '1901', from: ['1Pet.5.7'], fits: ['Heb.4', 'John.11', 'Ps.142'], themes: ['care', 'comfort'] },
  { title: 'Under His Wings', by: 'William O. Cushing', year: '1896', from: ['Ps.91.4'], fits: ['Ruth.2', 'Ps.17', 'Ps.36', 'Ps.57', 'Matt.23'], themes: ['care', 'trust', 'comfort'] },
  { title: 'Hiding in Thee', by: 'William O. Cushing', year: '1876', from: ['Ps.61.2'], fits: ['Ps.18', 'Ps.31', 'Ps.62', 'Ps.94'], themes: ['trust', 'comfort'] },
  { title: 'The Rock That Is Higher Than I', by: 'Erastus Johnson', year: '1871', from: ['Ps.61.2'], fits: ['Ps.62', 'Ps.18'], themes: ['trust', 'comfort'] },
  { title: 'He Hideth My Soul', by: 'Fanny J. Crosby', year: '1890', from: ['Exod.33.22'], fits: ['Isa.32', 'Ps.91', 'Ps.27'], themes: ['trust', 'care'] },
  { title: 'Rock of Ages', by: 'Augustus M. Toplady', year: '1776', fits: ['Exod.33', '1Cor.10', 'John.19', 'Isa.26', 'Deut.32', 'Ps.62'], themes: ['grace', 'cross', 'trust'] },
  { title: 'Jesus, Lover of My Soul', by: 'Charles Wesley', year: '1740', fits: ['Ps.57', 'Ps.91', 'Ps.17', 'Ps.46'], themes: ['trust', 'comfort'] },
  { title: 'Jesus, Savior, Pilot Me', by: 'Edward Hopper', year: '1871', fits: ['Mark.4', 'Ps.107', 'Acts.27', 'Jonah.1'], themes: ['guidance', 'trust'] },
  { title: 'Master, the Tempest Is Raging', by: 'Mary A. Baker', year: '1874', from: ['Mark.4.35-41'], fits: ['Matt.8', 'Luke.8', 'Ps.107', 'Jonah.1'], themes: ['peace', 'trust'] },
  { title: 'Love Lifted Me', by: 'James Rowe', year: '1912', from: ['Matt.14.22-33'], fits: ['Mark.6', 'Ps.40', 'Ps.69', 'John.6'], themes: ['grace', 'love'] },
  { title: '’Til the Storm Passes By', by: 'Mosie Lister', year: '1958', fits: ['Mark.4', 'Ps.57', 'Isa.25', 'Acts.27', 'Isa.4'], themes: ['trust', 'comfort'] },
  { title: 'Be with Me, Lord', by: 'Thomas O. Chisholm', year: '1935', fits: ['Matt.28', 'Heb.13', 'Ps.23', 'Isa.43', 'Josh.1', 'Gen.28', 'Exod.33'], themes: ['trust', 'prayer'] },
  { title: 'Jesus, Hold My Hand', by: 'Albert E. Brumley', year: '1933', fits: ['Isa.41', 'Ps.73', 'Ps.139', 'Ps.63'], themes: ['trust', 'guidance'] },
  { title: 'Like a River Glorious', by: 'Frances R. Havergal', year: '1874', from: ['Isa.26.3', 'Isa.48.18'], fits: ['Phil.4'], themes: ['peace', 'trust'] },
  { title: 'It Is Well with My Soul', by: 'Horatio G. Spafford', year: '1873', from: ['2Kgs.4.26'], fits: ['Job.1', 'Job.2', 'Phil.4', 'Col.2', '2Sam.12'], themes: ['peace', 'comfort', 'trust'] },
  { title: 'Farther Along', by: 'W. B. Stevens', year: '1911', fits: ['John.13', '1Cor.13', 'Ps.73', 'Job.23', 'Eccl.8', 'Rom.8', 'Hab.1'], themes: ['comfort', 'faith', 'heaven'] },
  { title: 'Count Your Blessings', by: 'Johnson Oatman Jr.', year: '1897', fits: ['Ps.103', 'Eph.1', 'Ps.68', 'Ps.40', 'Deut.8', 'Ps.116'], themes: ['thanks'] },
  { title: 'No, Not One!', by: 'Johnson Oatman Jr.', year: '1895', fits: ['Prov.18', 'John.15', 'Heb.4', 'Prov.17'], themes: ['love', 'comfort'] },
  { title: 'What a Friend We Have in Jesus', by: 'Joseph M. Scriven', year: 'c. 1855', fits: ['John.15', 'Phil.4', '1Pet.5', 'Matt.11', 'Heb.4'], themes: ['prayer', 'comfort', 'love'] },

  // ---- Prayer and the word ----
  { title: 'Sweet Hour of Prayer', by: 'William W. Walford', year: '1845', fits: ['Matt.6', 'Deut.34', '1Thess.5', 'Dan.6', 'Luke.18', 'Luke.11', 'Neh.1', 'Jas.5'], themes: ['prayer'] },
  { title: 'The Lord’s Prayer', by: 'set by Albert Hay Malotte', year: '1935', from: ['Matt.6.9-13', 'Luke.11.2-4'], themes: ['prayer'] },
  { title: 'I Need Thee Every Hour', by: 'Annie S. Hawks', year: '1872', fits: ['John.15', 'Ps.86', 'Ps.70', 'Ps.143'], themes: ['prayer', 'trust'] },
  { title: 'I Must Tell Jesus', by: 'Elisha A. Hoffman', year: '1894', fits: ['Phil.4', 'Heb.4', 'Ps.142', '1Sam.1', '2Kgs.19'], themes: ['prayer', 'comfort'] },
  { title: 'Tell It to Jesus', by: 'Jeremiah E. Rankin', year: '1876', fits: ['Phil.4', 'Heb.4', 'Ps.62', 'Ps.55'], themes: ['prayer', 'comfort'] },
  { title: 'Lord, We Come Before Thee Now', by: 'William Hammond', year: '1745', fits: ['Heb.4', 'Matt.18', 'Ps.95', 'Ps.122', 'Heb.10'], themes: ['prayer', 'praise'] },
  { title: 'Search Me, O God', by: 'J. Edwin Orr', year: '1936', from: ['Ps.139.23-24'], fits: ['Ps.51', 'Ps.26'], themes: ['repentance', 'prayer', 'holiness'] },
  { title: 'Create in Me a Clean Heart', from: ['Ps.51.10-12'], themes: ['repentance', 'prayer'] },
  { title: 'Whiter Than Snow', by: 'James L. Nicholson', year: '1872', from: ['Ps.51.7'], fits: ['Isa.1'], themes: ['repentance', 'grace'] },
  { title: 'Draw Me Nearer', by: 'Fanny J. Crosby', year: '1875', from: ['Heb.10.22', 'Jas.4.8'], fits: ['Ps.73'], themes: ['prayer', 'commitment'] },
  { title: 'Nearer, My God, to Thee', by: 'Sarah F. Adams', year: '1841', from: ['Gen.28.10-22'], fits: ['Jas.4', 'Ps.73'], themes: ['prayer', 'trust'] },
  { title: 'Wonderful Words of Life', by: 'Philip P. Bliss', year: '1874', from: ['John.6.68'], fits: ['Ps.119', 'Heb.4', 'Ps.19', 'Deut.32', 'Neh.8'], themes: ['word'] },
  { title: 'Break Thou the Bread of Life', by: 'Mary A. Lathbury', year: '1877', from: ['John.6.35'], fits: ['Matt.14', 'Mark.6', 'Luke.24', 'Ps.119', 'Amos.8'], themes: ['word'] },
  { title: 'Thy Word Have I Hid in My Heart', by: 'Ernest O. Sellers', year: '1908', from: ['Ps.119.11', 'Ps.119.105'], fits: ['Deut.6', 'Josh.1'], themes: ['word'] },
  { title: 'How Shall the Young Secure Their Hearts', by: 'Isaac Watts', year: '1719', from: ['Ps.119.9-11'], fits: ['Eccl.12', 'Prov.1', 'Prov.4', '1Tim.4', '2Tim.3'], themes: ['word', 'holiness'] },
  { title: 'Holy Bible, Book Divine', by: 'John Burton Sr.', year: '1803', fits: ['2Tim.3', 'Ps.19', 'Ps.119', '2Kgs.22', 'Neh.8', 'Jer.36', '2Pet.1'], themes: ['word'] },
  { title: 'Lord, Speak to Me', by: 'Frances R. Havergal', year: '1872', fits: ['1Sam.3', 'Rom.14', 'Isa.50'], themes: ['service', 'prayer'] },
  { title: 'Seek Ye First', by: 'Karen Lafferty', year: '1972', from: ['Matt.6.33', 'Matt.7.7'], fits: ['Luke.12'], themes: ['trust', 'prayer'] },

  // ---- Repentance, invitation and grace ----
  { title: 'Amazing Grace', by: 'John Newton', year: '1779', from: ['1Chr.17.16-17'], fits: ['Eph.2', 'John.9', '1Tim.1', 'Luke.15', '2Sam.7', 'Titus.2'], themes: ['grace'] },
  { title: 'Wonderful Grace of Jesus', by: 'Haldor Lillenas', year: '1918', fits: ['2Cor.12', 'Eph.2', 'Rom.5', 'Titus.3'], themes: ['grace'] },
  { title: 'Grace Greater Than Our Sin', by: 'Julia H. Johnston', year: '1911', from: ['Rom.5.20'], fits: ['Eph.2', 'Rom.6', 'Mic.7'], themes: ['grace', 'cross'] },
  { title: 'Softly and Tenderly', by: 'Will L. Thompson', year: '1880', fits: ['Matt.11', 'Rev.22', 'Luke.15', 'Isa.55', 'Hos.14', 'Jer.3'], themes: ['invitation'] },
  { title: 'Just as I Am', by: 'Charlotte Elliott', year: '1835', fits: ['John.6', 'Matt.11', 'Luke.18', 'Rom.5'], themes: ['invitation', 'repentance'] },
  { title: 'Jesus Is Tenderly Calling', by: 'Fanny J. Crosby', year: '1883', fits: ['Matt.11', 'Luke.15', 'Isa.55', 'Prov.1'], themes: ['invitation'] },
  { title: 'Almost Persuaded', by: 'Philip P. Bliss', year: '1871', from: ['Acts.26.27-29'], fits: ['Acts.24', 'Mark.10'], themes: ['invitation'] },
  { title: 'O Why Not Tonight?', by: 'Eliza Reed', year: '1842', fits: ['2Cor.6', 'Acts.24', 'Heb.3', 'Isa.55', 'Prov.27'], themes: ['invitation'] },
  { title: 'Why Not Now?', by: 'Daniel W. Whittle', from: ['2Cor.6.2'], fits: ['Acts.22', 'Heb.3'], themes: ['invitation'] },
  { title: 'Lord, I’m Coming Home', by: 'William J. Kirkpatrick', year: '1892', from: ['Luke.15.11-24'], fits: ['Hos.14', 'Jer.3', 'Joel.2', 'Isa.55'], themes: ['repentance', 'invitation'] },
  { title: 'The Ninety and Nine', by: 'Elizabeth C. Clephane', year: '1868', from: ['Luke.15.3-7', 'Matt.18.12-14'], fits: ['Ezek.34'], themes: ['grace', 'love'] },
  { title: 'Ye Must Be Born Again', by: 'William T. Sleeper', year: '1877', from: ['John.3.1-7'], fits: ['Titus.3', '1Pet.1'], themes: ['invitation'] },
  { title: 'Is Thy Heart Right with God?', by: 'Elisha A. Hoffman', year: '1900', from: ['Acts.8.21'], fits: ['Ps.51', 'Jer.17', '1Sam.16'], themes: ['repentance', 'holiness'] },
  { title: 'O Happy Day', by: 'Philip Doddridge', year: '1755', fits: ['Acts.8', 'Acts.16', 'Rom.6', 'Josh.24'], themes: ['commitment', 'thanks'] },
  { title: 'Come, Thou Fount of Every Blessing', by: 'Robert Robinson', year: '1758', from: ['1Sam.7.12'], fits: ['Luke.15', 'Ps.119'], themes: ['grace', 'praise'] },
  { title: 'Heaven Came Down', by: 'John W. Peterson', year: '1961', fits: ['2Cor.5', 'John.3', 'Acts.9', 'Acts.2'], themes: ['grace', 'thanks'] },
  { title: 'Since Jesus Came into My Heart', by: 'Rufus H. McDaniel', year: '1914', fits: ['2Cor.5', 'Eph.3', 'Luke.19', 'Acts.9'], themes: ['grace', 'thanks'] },
  { title: 'Redeemed', by: 'Fanny J. Crosby', year: '1882', from: ['Ps.107.2'], fits: ['1Pet.1', 'Ruth.4', 'Gal.3', 'Exod.6', 'Isa.44'], themes: ['grace', 'thanks'] },
  { title: 'Blessed Assurance', by: 'Fanny J. Crosby', year: '1873', fits: ['Heb.10', '1John.5', 'Rom.8', '2Tim.1'], themes: ['faith', 'praise'] },
  { title: 'I Know Whom I Have Believed', by: 'Daniel W. Whittle', year: '1883', from: ['2Tim.1.12'], fits: ['Job.19', 'Rom.8'], themes: ['faith', 'trust'] },
  { title: 'To God Be the Glory', by: 'Fanny J. Crosby', year: '1875', fits: ['John.3', 'Eph.3', 'Gal.1', 'Rom.11'], themes: ['praise', 'grace'] },
  { title: 'Wonderful Story of Love', by: 'J. M. Driver', fits: ['John.3', 'Luke.15', 'Rom.5', '1John.4'], themes: ['love', 'invitation'] },
  { title: 'Why Did My Savior Come to Earth?', by: 'J. G. Dailey', year: '1892', fits: ['John.3', 'Phil.2', 'Luke.19', '1Tim.1', 'Isa.53'], themes: ['love', 'cross'] },
  { title: 'Jesus Loves Me', by: 'Anna B. Warner', year: '1860', fits: ['Mark.10', 'Matt.19', '1John.4', 'Luke.18'], themes: ['love'] },
  { title: 'O How I Love Jesus', by: 'Frederick Whitfield', year: '1855', from: ['1John.4.19'], fits: ['Phil.2', 'John.21'], themes: ['love', 'praise'] },
  { title: 'More Love to Thee', by: 'Elizabeth P. Prentiss', year: '1856', fits: ['John.21', 'Deut.6', 'Mark.12', '1Cor.13'], themes: ['love', 'commitment'] },
  { title: 'Love Divine, All Loves Excelling', by: 'Charles Wesley', year: '1747', fits: ['2Cor.5', '2Cor.3', '1John.4', '1Cor.13', 'Mal.3'], themes: ['love', 'holiness'] },
  { title: 'Purer in Heart, O God', by: 'Fannie E. S. Davison', year: '1877', from: ['Matt.5.8'], fits: ['Ps.24', 'Ps.51', '1John.3'], themes: ['holiness', 'prayer'] },
  { title: 'Take My Life and Let It Be', by: 'Frances R. Havergal', year: '1874', from: ['Rom.12.1-2'], fits: ['1Chr.29', '2Cor.8', 'Exod.35'], themes: ['commitment', 'service'] },
  { title: 'Have Thine Own Way, Lord', by: 'Adelaide A. Pollard', year: '1906', from: ['Jer.18.1-6', 'Isa.64.8'], fits: ['Rom.9', '2Tim.2'], themes: ['commitment', 'obedience'] },
  { title: 'I Am Resolved', by: 'Palmer Hartsough', year: '1896', fits: ['Josh.24', 'Dan.1', 'Ruth.1', 'Luke.9', '1Kgs.18'], themes: ['commitment'] },
  { title: 'Who Is on the Lord’s Side?', by: 'Frances R. Havergal', year: '1877', from: ['Exod.32.26', '1Chr.12.18'], fits: ['Josh.24', '1Kgs.18'], themes: ['commitment', 'victory'] },
  { title: 'Dare to Be a Daniel', by: 'Philip P. Bliss', year: '1873', from: ['Dan.1', 'Dan.6'], fits: ['Dan.3'], themes: ['commitment', 'faith'] },
  { title: 'Higher Ground', by: 'Johnson Oatman Jr.', year: '1898', fits: ['Phil.3', 'Col.3', 'Heb.6', 'Hab.3'], themes: ['commitment', 'holiness'] },
  { title: 'More About Jesus', by: 'Eliza E. Hewitt', year: '1887', from: ['2Pet.3.18'], fits: ['Phil.3', 'John.17'], themes: ['word', 'commitment'] },
  { title: 'Where He Leads Me', by: 'E. W. Blandly', year: '1890', from: ['Luke.9.23', 'Matt.16.24'], fits: ['Mark.1', 'Matt.4', 'Matt.26', 'Ruth.1'], themes: ['commitment', 'obedience'] },
  { title: 'Footprints of Jesus', by: 'Mary B. C. Slade', year: '1871', from: ['1Pet.2.21'], fits: ['Matt.4', 'John.13', 'Mark.1'], themes: ['commitment', 'obedience'] },
  { title: 'Must Jesus Bear the Cross Alone?', by: 'Thomas Shepherd', year: '1693', from: ['Mark.15.21', 'Luke.23.26'], fits: ['Matt.16', 'Matt.27', 'Luke.14'], themes: ['commitment', 'cross'] },
  { title: 'The Way of the Cross Leads Home', by: 'Jessie B. Pounds', year: '1906', from: ['Luke.9.23'], fits: ['Matt.16', 'John.14'], themes: ['cross', 'heaven'] },
  { title: 'Living by Faith', by: 'James Wells', fits: ['Hab.2', 'Rom.1', 'Gal.2', 'Heb.11', 'Hab.3', '2Cor.5'], themes: ['faith', 'trust'] },
  { title: 'My Faith Looks Up to Thee', by: 'Ray Palmer', year: '1830', fits: ['Heb.12', 'John.3', 'Num.21'], themes: ['faith', 'prayer'] },
  { title: 'Faith Is the Victory', by: 'John H. Yates', year: '1891', from: ['1John.5.4'], fits: ['Eph.6', '1Sam.17', 'Josh.6', 'Heb.11', '2Kgs.6', '2Chr.20'], themes: ['faith', 'victory'] },

  // ---- Christ's life ----
  { title: 'Joy to the World', by: 'Isaac Watts', year: '1719', from: ['Ps.98'], fits: ['Gen.3', 'Luke.2', 'Ps.96', 'Isa.9'], themes: ['reign', 'birth', 'praise'] },
  { title: 'O Little Town of Bethlehem', by: 'Phillips Brooks', year: '1868', from: ['Mic.5.2', 'Luke.2.1-20'], fits: ['Matt.2'], themes: ['birth'] },
  { title: 'Silent Night', by: 'Joseph Mohr; tr. John F. Young', year: '1818/1863', from: ['Luke.2.1-20'], themes: ['birth', 'peace'] },
  { title: 'Hark! the Herald Angels Sing', by: 'Charles Wesley', year: '1739', from: ['Luke.2.8-20'], fits: ['Isa.9', 'Mal.4', 'John.1', 'Isa.7'], themes: ['birth', 'praise'] },
  { title: 'O Come, All Ye Faithful', by: 'attr. John F. Wade', year: 'c. 1743', from: ['Luke.2.8-20'], fits: ['John.1'], themes: ['birth', 'praise'] },
  { title: 'Angels from the Realms of Glory', by: 'James Montgomery', year: '1816', from: ['Luke.2.8-20', 'Matt.2.1-12'], fits: ['Mal.3'], themes: ['birth', 'praise'] },
  { title: 'It Came upon the Midnight Clear', by: 'Edmund H. Sears', year: '1849', from: ['Luke.2.8-14'], fits: ['Isa.2'], themes: ['birth', 'peace'] },
  { title: 'Tell Me the Story of Jesus', by: 'Fanny J. Crosby', year: '1880', fits: ['Luke.2', 'Matt.4', 'Luke.23', 'Mark.1', 'Luke.4'], themes: ['cross', 'love'] },
  { title: 'Tell Me the Old, Old Story', by: 'A. Katherine Hankey', year: '1866', fits: ['Luke.24', '1Cor.15', 'Acts.8'], themes: ['evangelism', 'cross'] },
  { title: 'I Love to Tell the Story', by: 'A. Katherine Hankey', year: '1866', fits: ['Ps.107', 'Acts.4', 'Mark.5', 'Acts.26', 'John.4'], themes: ['evangelism'] },
  { title: 'Fill My Cup, Lord', by: 'Richard Blanchard', year: '1959', from: ['John.4.13-14'], fits: ['Isa.55', 'John.7', 'Ps.42'], themes: ['invitation', 'prayer'] },
  { title: 'I Heard the Voice of Jesus Say', by: 'Horatius Bonar', year: '1846', from: ['Matt.11.28', 'John.4.14', 'John.8.12'], themes: ['invitation', 'peace'] },
  { title: 'The Light of the World Is Jesus', by: 'Philip P. Bliss', year: '1875', from: ['John.8.12', 'John.9.5'], fits: ['Isa.9', 'Isa.60', 'John.1'], themes: ['evangelism', 'grace'] },
  { title: 'Where Could I Go?', by: 'James B. Coats', year: '1940', from: ['John.6.66-69'], fits: ['Ps.139'], themes: ['faith', 'trust'] },
  { title: 'Pass Me Not, O Gentle Savior', by: 'Fanny J. Crosby', year: '1868', fits: ['Mark.10', 'Luke.18', 'Matt.15', 'Matt.9', 'Mark.5'], themes: ['prayer', 'grace'] },
  { title: 'Hosanna, Loud Hosanna', by: 'Jennette Threlfall', year: '1873', from: ['Matt.21.1-11', 'Mark.11.1-11', 'Luke.19.28-40', 'John.12.12-19'], fits: ['Zech.9', 'Ps.118'], themes: ['praise', 'reign'] },
  { title: 'Ride On, Ride On in Majesty', by: 'Henry H. Milman', year: '1827', from: ['Matt.21.1-11', 'Luke.19.28-40'], fits: ['Zech.9'], themes: ['reign', 'cross'] },

  // ---- The cross, the Lord's Supper ----
  { title: 'Night, with Ebon Pinion', by: 'L. H. Jameson', year: '1854', from: ['Matt.26.36-46', 'Mark.14.32-42', 'Luke.22.39-46'], themes: ['cross', 'prayer'] },
  { title: '’Tis Midnight, and on Olive’s Brow', by: 'William B. Tappan', year: '1822', from: ['Luke.22.39-46', 'Matt.26.36-46'], fits: ['Mark.14'], themes: ['cross', 'prayer'] },
  { title: 'Go to Dark Gethsemane', by: 'James Montgomery', year: '1820', from: ['Matt.26.36-46'], fits: ['Mark.14', 'Luke.22', 'John.18', 'Luke.23'], themes: ['cross', 'prayer'] },
  { title: 'In Memory of the Savior’s Love', by: 'Thomas Cotterill', year: '1805', from: ['1Cor.11.23-26', 'Luke.22.19-20'], fits: ['Matt.26', 'Mark.14', 'Acts.20', 'Exod.12', '1Cor.10'], themes: ['supper', 'cross'] },
  { title: 'According to Thy Gracious Word', by: 'James Montgomery', year: '1825', from: ['Luke.22.19', '1Cor.11.24'], fits: ['Matt.26'], themes: ['supper', 'cross'] },
  { title: 'O Sacred Head, Now Wounded', by: 'attr. Bernard of Clairvaux; tr. James W. Alexander', year: '1830', from: ['Matt.27.27-31', 'Mark.15.16-20', 'John.19.1-5'], fits: ['Isa.53', 'Isa.50'], themes: ['cross', 'love'] },
  { title: 'When I Survey the Wondrous Cross', by: 'Isaac Watts', year: '1707', from: ['Gal.6.14'], fits: ['Phil.3', 'Matt.27', 'John.19', 'Mark.15'], themes: ['cross', 'commitment', 'supper'] },
  { title: 'Alas! and Did My Savior Bleed', by: 'Isaac Watts', year: '1707', fits: ['Isa.53', 'Luke.23', 'Rom.5', 'Mark.15'], themes: ['cross', 'grace', 'supper'] },
  { title: 'The Old Rugged Cross', by: 'George Bennard', year: '1913', fits: ['Gal.6', 'Phil.2', 'John.19', 'Heb.12', 'Col.2', '1Cor.1'], themes: ['cross', 'supper'] },
  { title: 'Jesus, Keep Me Near the Cross', by: 'Fanny J. Crosby', year: '1869', fits: ['Gal.6', 'John.19', 'Ezek.47', 'Zech.13'], themes: ['cross', 'supper'] },
  { title: 'Beneath the Cross of Jesus', by: 'Elizabeth C. Clephane', year: '1868', from: ['Isa.32.2'], fits: ['Gal.6', 'Gen.28', 'Ps.63'], themes: ['cross', 'comfort', 'supper'] },
  { title: 'At Calvary', by: 'William R. Newell', year: '1895', fits: ['Luke.23', '1Tim.1', 'Rom.5', 'Eph.1'], themes: ['cross', 'grace'] },
  { title: 'Lead Me to Calvary', by: 'Jennie E. Hussey', year: '1921', fits: ['Luke.23', 'Matt.27', 'Mark.15', 'Luke.9', 'John.19'], themes: ['cross', 'supper'] },
  { title: 'Hallelujah! What a Savior', by: 'Philip P. Bliss', year: '1875', fits: ['Isa.53', 'Matt.27', 'John.19', 'Heb.7', 'Mark.15', 'Ps.22'], themes: ['cross', 'praise', 'supper'] },
  { title: 'There Is a Fountain', by: 'William Cowper', year: '1772', from: ['Zech.13.1'], fits: ['Luke.23', '1John.1', 'Rev.1'], themes: ['cross', 'grace', 'supper'] },
  { title: 'Jesus Paid It All', by: 'Elvina M. Hall', year: '1865', fits: ['Isa.1', 'John.19', 'Ps.51', '1Pet.1', 'Col.2'], themes: ['cross', 'grace', 'supper'] },
  { title: 'Nothing but the Blood', by: 'Robert Lowry', year: '1876', fits: ['Heb.9', '1John.1', 'Lev.17', 'Exod.12', 'Lev.16', 'Eph.1'], themes: ['cross', 'grace', 'supper'] },
  { title: 'There Is Power in the Blood', by: 'Lewis E. Jones', year: '1899', fits: ['Rev.12', 'Rev.1', 'Rom.3', 'Heb.9'], themes: ['cross', 'victory'] },
  { title: 'Are You Washed in the Blood?', by: 'Elisha A. Hoffman', year: '1878', from: ['Rev.7.14'], fits: ['1John.1', 'Acts.22', 'Rev.1'], themes: ['cross', 'invitation'] },
  { title: 'Christ, We Do All Adore Thee', by: 'Théodore Dubois', year: '1867', fits: ['Gal.6', 'Phil.2', 'John.12', 'Rev.5'], themes: ['cross', 'praise', 'supper'] },

  // ---- Resurrection and reign ----
  { title: 'Low in the Grave He Lay', by: 'Robert Lowry', year: '1874', from: ['Matt.28.1-10', 'Luke.24.1-12'], fits: ['Mark.16', 'John.20', '1Cor.15', 'Acts.2', 'Ps.16'], themes: ['resurrection', 'victory'] },
  { title: 'Christ the Lord Is Risen Today', by: 'Charles Wesley', year: '1739', from: ['Matt.28.1-10', '1Cor.15.55'], fits: ['Mark.16', 'Luke.24', 'John.20', 'Rom.6'], themes: ['resurrection', 'praise'] },
  { title: 'Because He Lives', by: 'Bill & Gloria Gaither', year: '1971', from: ['John.14.19'], fits: ['1Cor.15', 'Rom.6', 'John.11', '1Pet.1'], themes: ['resurrection', 'trust'] },
  { title: 'In the Garden', by: 'C. Austin Miles', year: '1912', from: ['John.20.11-18'], themes: ['resurrection', 'prayer'] },
  { title: 'We Saw Thee Not', by: 'John H. Gurney', fits: ['John.20', '1Pet.1', 'Heb.11', '2Cor.5'], themes: ['faith', 'resurrection'] },
  { title: 'I Know That My Redeemer Lives', by: 'Samuel Medley', year: '1775', from: ['Job.19.25-27'], fits: ['1Cor.15', 'Ruth.4'], themes: ['resurrection', 'faith'] },
  { title: 'Victory in Jesus', by: 'Eugene M. Bartlett', year: '1939', fits: ['1Cor.15', 'Rom.8', 'Mark.5', 'Col.2'], themes: ['victory', 'grace'] },
  { title: 'All Hail the Power of Jesus’ Name', by: 'Edward Perronet', year: '1779', fits: ['Phil.2', 'Rev.19', 'Rev.5', 'Acts.4', 'Dan.7'], themes: ['reign', 'praise'] },
  { title: 'Crown Him with Many Crowns', by: 'Matthew Bridges', year: '1851', from: ['Rev.19.12'], fits: ['Rev.5', 'Heb.2', 'Ps.2', 'Ps.110', 'Dan.7'], themes: ['reign', 'praise'] },
  { title: 'Jesus Shall Reign', by: 'Isaac Watts', year: '1719', from: ['Ps.72'], fits: ['Dan.2', 'Isa.11', 'Ps.2', 'Dan.7'], themes: ['reign', 'evangelism'] },
  { title: 'Take the Name of Jesus with You', by: 'Lydia Baxter', year: '1870', fits: ['Phil.2', 'Acts.4', 'Col.3', 'Prov.18'], themes: ['comfort', 'prayer'] },
  { title: 'O for a Thousand Tongues to Sing', by: 'Charles Wesley', year: '1739', fits: ['Isa.35', 'Mark.7', 'Ps.145', 'Acts.3', 'Ps.71'], themes: ['praise', 'grace'] },
  { title: 'Ten Thousand Times Ten Thousand', by: 'Henry Alford', year: '1867', from: ['Rev.5.11', 'Rev.7.9-17'], fits: ['Dan.7', 'Heb.12'], themes: ['heaven', 'praise'] },
  { title: 'Worthy Art Thou', from: ['Rev.4.11', 'Rev.5.9-12'], themes: ['praise', 'reign'] },

  // ---- The church and fellowship ----
  { title: 'The Church’s One Foundation', by: 'Samuel J. Stone', year: '1866', fits: ['Matt.16', '1Cor.3', 'Eph.2', 'Eph.5', 'Rev.19', 'Acts.2', 'Eph.4', '1Pet.2'], themes: ['church'] },
  { title: 'I Love Thy Kingdom, Lord', by: 'Timothy Dwight', year: '1800', from: ['Ps.137.5-6'], fits: ['Matt.16', 'Eph.5', 'Ps.122', 'Acts.2', 'Col.1', 'Dan.2'], themes: ['church'] },
  { title: 'Glorious Things of Thee Are Spoken', by: 'John Newton', year: '1779', from: ['Ps.87.3'], fits: ['Isa.33', 'Exod.16', 'Exod.13', 'Ps.48', 'Heb.12', 'Gal.4'], themes: ['church', 'praise'] },
  { title: 'Blest Be the Tie That Binds', by: 'John Fawcett', year: '1782', fits: ['Gal.6', 'Eph.4', 'John.17', 'Col.3', 'Acts.20', 'Ps.133', 'Phil.1', 'Rom.12', '1Cor.12'], themes: ['church', 'love'] },
  { title: 'God Be with You Till We Meet Again', by: 'Jeremiah E. Rankin', year: '1880', fits: ['Num.6', '2Cor.13', 'Acts.20', 'Ruth.1', '1Sam.20', 'Gen.31'], themes: ['care', 'church'] },
  { title: 'Sing and Be Happy', by: 'Emory S. Peck', year: '1940', fits: ['Ps.100', 'Phil.4', 'Jas.5', 'Eph.5', 'Col.3', 'Neh.8', 'Ps.95'], themes: ['praise', 'thanks'] },
  { title: 'Revive Us Again', by: 'William P. Mackay', year: '1863', from: ['Ps.85.6'], fits: ['Hab.3', '2Chr.7', '2Kgs.23', 'Neh.9', 'Ezra.9'], themes: ['repentance', 'praise'] },
  { title: 'Faith of Our Fathers', by: 'Frederick W. Faber', year: '1849', fits: ['Heb.11', 'Jude.1', 'Acts.7', 'Dan.3', '2Tim.4', 'Rev.2'], themes: ['faith', 'commitment'] },

  // ---- Service and evangelism ----
  { title: 'Soldiers of Christ, Arise', by: 'Charles Wesley', year: '1749', from: ['Eph.6.10-18'], fits: ['2Tim.2', '1Tim.6'], themes: ['victory', 'commitment'] },
  { title: 'Stand Up, Stand Up for Jesus', by: 'George Duffield Jr.', year: '1858', from: ['Eph.6.10-18'], fits: ['1Cor.16', 'Josh.1', '2Chr.20'], themes: ['victory', 'commitment'] },
  { title: 'Am I a Soldier of the Cross?', by: 'Isaac Watts', year: '1724', fits: ['2Tim.2', '1Cor.16', 'Eph.6', '1Tim.6', '2Tim.4'], themes: ['victory', 'commitment'] },
  { title: 'Onward, Christian Soldiers', by: 'Sabine Baring-Gould', year: '1865', fits: ['2Tim.2', 'Eph.6', 'Josh.6', 'Matt.16'], themes: ['victory', 'church'] },
  { title: 'Work, for the Night Is Coming', by: 'Anna L. Coghill', year: '1854', from: ['John.9.4'], fits: ['Eccl.9', 'Eccl.11', 'Gal.6'], themes: ['service'] },
  { title: 'We’ll Work Till Jesus Comes', by: 'Elizabeth Mills', year: '1836', fits: ['1Cor.15', 'John.9', 'Luke.19', 'Matt.25'], themes: ['service', 'heaven'] },
  { title: 'To the Work!', by: 'Fanny J. Crosby', year: '1869', fits: ['1Cor.15', 'Neh.4', 'Neh.2', 'Hag.1', 'Hag.2', 'Ezra.5'], themes: ['service'] },
  { title: 'Bringing in the Sheaves', by: 'Knowles Shaw', year: '1874', from: ['Ps.126.5-6'], fits: ['Eccl.11', 'Matt.13', 'Gal.6', 'John.4', 'Ruth.2', 'Mark.4'], themes: ['service', 'evangelism'] },
  { title: 'Hark! the Voice of Jesus Calling', by: 'Daniel March', year: '1868', from: ['Isa.6.8'], fits: ['John.4', 'Matt.9', 'Jonah.3', 'Jer.1', 'Exod.4'], themes: ['service', 'evangelism'] },
  { title: 'Send the Light', by: 'Charles H. Gabriel', year: '1890', from: ['Acts.16.9'], fits: ['Matt.28', 'Mark.16', 'Rom.10', 'Isa.60', 'Acts.13'], themes: ['evangelism'] },
  { title: 'Jesus Saves', by: 'Priscilla J. Owens', year: '1882', fits: ['Matt.28', 'Acts.1', 'Mark.16', 'Isa.52', 'Rom.10', 'Acts.4'], themes: ['evangelism'] },
  { title: 'Rescue the Perishing', by: 'Fanny J. Crosby', year: '1869', fits: ['Jude.1', 'Luke.14', 'Luke.15', 'Ezek.33', 'Jas.5'], themes: ['evangelism', 'service'] },

  // ---- Heaven, judgment and the end ----
  { title: 'When We All Get to Heaven', by: 'Eliza E. Hewitt', year: '1898', fits: ['John.14', 'Rev.21', 'Rev.22', '1Thess.4', '1John.3'], themes: ['heaven'] },
  { title: 'Will There Be Any Stars in My Crown?', by: 'Eliza E. Hewitt', year: '1897', from: ['Dan.12.3'], fits: ['1Thess.2', 'Phil.4', '2Tim.4', 'Prov.11', 'Jas.5'], themes: ['service', 'heaven'] },
  { title: 'When the Roll Is Called Up Yonder', by: 'James M. Black', year: '1893', from: ['1Thess.4.16-17'], fits: ['Rev.20', '1Cor.15', 'Phil.4', 'Luke.10', 'Mal.3'], themes: ['heaven', 'judgment'] },
  { title: 'Shall We Gather at the River?', by: 'Robert Lowry', year: '1864', from: ['Rev.22.1-2'], fits: ['Ezek.47', 'Ps.46'], themes: ['heaven'] },
  { title: 'On Jordan’s Stormy Banks', by: 'Samuel Stennett', year: '1787', fits: ['Josh.3', 'Deut.34', 'Num.13', 'Heb.4', 'Josh.1', 'Deut.3'], themes: ['heaven'] },
  { title: 'Beulah Land', by: 'Edgar P. Stites', year: '1876', from: ['Isa.62.4'], fits: ['Num.13', 'Heb.11'], themes: ['heaven'] },
  { title: 'In the Sweet By and By', by: 'S. Fillmore Bennett', year: '1868', fits: ['Heb.11', 'John.14', 'Rev.21', 'Heb.13'], themes: ['heaven', 'comfort'] },
  { title: 'Where the Soul Never Dies', by: 'William M. Golden', year: '1914', fits: ['2Cor.5', 'Rev.21', 'John.11', 'Rev.7'], themes: ['heaven', 'comfort'] },
  { title: 'Home of the Soul', by: 'Ellen H. Gates', year: '1865', fits: ['John.14', '2Cor.5', 'Heb.11', 'Rev.21'], themes: ['heaven'] },
  { title: 'Beyond the Sunset', by: 'Virgil P. Brock', year: '1936', fits: ['Rev.21', 'Rev.22', 'Isa.60'], themes: ['heaven', 'comfort'] },
  { title: 'I’ll Fly Away', by: 'Albert E. Brumley', year: '1929', fits: ['2Cor.5', '1Thess.4', 'Ps.90', 'Ps.55', '2Kgs.2', 'Phil.1'], themes: ['heaven'] },
  { title: 'Abide with Me', by: 'Henry F. Lyte', year: '1847', from: ['Luke.24.29'], fits: ['1Cor.15', 'Ps.39', 'Ps.102', 'Mal.3'], themes: ['comfort', 'prayer', 'heaven'] },
  { title: 'There’s a Great Day Coming', by: 'Will L. Thompson', year: '1887', fits: ['Matt.25', '2Cor.5', 'Rev.20', '2Pet.3', 'Joel.2', 'Zeph.1', 'Mal.4', 'Acts.17', 'Eccl.12', 'Amos.5'], themes: ['judgment', 'invitation'] },
];

/**
 * Themes of each book, used to suggest hymns when a chapter has no hand-picked match
 * (genealogies, laws, lists and so on). Two or three per book, in order of weight.
 */
export const BOOK_THEMES: Record<string, Theme[]> = {
  Gen: ['creation', 'faithfulness', 'care'], Exod: ['guidance', 'holiness', 'faithfulness'],
  Lev: ['holiness', 'cross', 'obedience'], Num: ['guidance', 'obedience', 'faithfulness'],
  Deut: ['obedience', 'word', 'love'], Josh: ['faith', 'victory', 'commitment'],
  Judg: ['repentance', 'faithfulness', 'victory'], Ruth: ['care', 'faithfulness', 'love'],
  '1Sam': ['obedience', 'trust', 'prayer'], '2Sam': ['repentance', 'faithfulness', 'praise'],
  '1Kgs': ['commitment', 'prayer', 'faithfulness'], '2Kgs': ['faith', 'repentance', 'care'],
  '1Chr': ['praise', 'faithfulness', 'church'], '2Chr': ['repentance', 'praise', 'prayer'],
  Ezra: ['word', 'repentance', 'service'], Neh: ['service', 'prayer', 'word'],
  Esth: ['care', 'trust', 'commitment'], Job: ['trust', 'comfort', 'creation'],
  Ps: ['praise', 'trust', 'prayer'], Prov: ['guidance', 'word', 'obedience'],
  Eccl: ['judgment', 'commitment', 'heaven'], Song: ['love', 'praise'],
  Isa: ['holiness', 'cross', 'comfort'], Jer: ['repentance', 'obedience', 'faithfulness'],
  Lam: ['faithfulness', 'repentance', 'comfort'], Ezek: ['repentance', 'holiness', 'reign'],
  Dan: ['commitment', 'reign', 'faith'], Hos: ['love', 'repentance', 'invitation'],
  Joel: ['repentance', 'judgment', 'grace'], Amos: ['repentance', 'judgment', 'holiness'],
  Obad: ['judgment', 'reign'], Jonah: ['obedience', 'grace', 'evangelism'],
  Mic: ['repentance', 'grace', 'birth'], Nah: ['judgment', 'trust'],
  Hab: ['faith', 'trust', 'judgment'], Zeph: ['judgment', 'repentance', 'love'],
  Hag: ['service', 'commitment'], Zech: ['reign', 'cross', 'repentance'],
  Mal: ['repentance', 'faithfulness', 'judgment'],
  Matt: ['reign', 'commitment', 'cross'], Mark: ['service', 'faith', 'cross'],
  Luke: ['grace', 'invitation', 'prayer'], John: ['faith', 'love', 'resurrection'],
  Acts: ['evangelism', 'church', 'commitment'], Rom: ['grace', 'faith', 'commitment'],
  '1Cor': ['church', 'love', 'resurrection'], '2Cor': ['comfort', 'grace', 'service'],
  Gal: ['grace', 'faith', 'cross'], Eph: ['grace', 'church', 'victory'],
  Phil: ['praise', 'peace', 'commitment'], Col: ['reign', 'commitment', 'praise'],
  '1Thess': ['heaven', 'love', 'holiness'], '2Thess': ['judgment', 'faithfulness', 'service'],
  '1Tim': ['church', 'commitment', 'word'], '2Tim': ['word', 'commitment', 'victory'],
  Titus: ['grace', 'holiness', 'church'], Phlm: ['love', 'church', 'grace'],
  Heb: ['faith', 'cross', 'faithfulness'], Jas: ['obedience', 'prayer', 'faith'],
  '1Pet': ['comfort', 'holiness', 'commitment'], '2Pet': ['judgment', 'word', 'faithfulness'],
  '1John': ['love', 'cross', 'faith'], '2John': ['love', 'obedience'], '3John': ['love', 'service'],
  Jude: ['faith', 'commitment', 'judgment'], Rev: ['heaven', 'reign', 'victory'],
};

export interface HymnMatch {
  hymn: Hymn;
  /** the passage that ties it to this chapter, e.g. "Ps.23.1" (verse part optional) */
  ref: string;
}

export interface ChapterHymns {
  from: HymnMatch[];
  fits: HymnMatch[];
  /** suggestions from the book's themes, when the chapter has few or none of its own */
  book: Hymn[];
}

const inChapter = (ref: string, book: string, chapter: number) => {
  const [b, c] = ref.split('.');
  return b === book && Number(c) === chapter;
};

/** Small stable hash, so each chapter shows its own selection of book-theme hymns. */
const hash = (s: string) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);

export function hymnsForChapter(book: string, chapter: number): ChapterHymns {
  const from: HymnMatch[] = [];
  const fits: HymnMatch[] = [];
  for (const hymn of HYMNS) {
    const f = hymn.from?.find((r) => inChapter(r, book, chapter));
    if (f) {
      from.push({ hymn, ref: f });
      continue;
    }
    const t = hymn.fits?.find((r) => inChapter(r, book, chapter));
    if (t) fits.push({ hymn, ref: t });
  }
  const shown = from.length + fits.length;
  let bookHymns: Hymn[] = [];
  if (shown < 3) {
    const themes = BOOK_THEMES[book] ?? ['praise'];
    const used = new Set([...from, ...fits].map((m) => m.hymn));
    // score: earlier book themes weigh more; a stable per-chapter shuffle breaks ties
    const seed = hash(`${book}.${chapter}`);
    bookHymns = HYMNS.filter((h) => !used.has(h) && h.themes.some((t) => themes.includes(t)))
      .map((h) => ({
        h,
        score:
          h.themes.reduce((s, t) => s + (themes.includes(t) ? themes.length - themes.indexOf(t) : 0), 0) * 1000 +
          (hash(h.title + seed) % 1000),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5 - Math.min(shown, 2))
      .map((x) => x.h);
  }
  return { from, fits, book: bookHymns };
}

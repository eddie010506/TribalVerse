-- Add realistic users with hashed passwords
-- All passwords are 'pass123' (but we're using dummy hashes since we'll never log in as these users)
INSERT INTO users (username, password, email, email_verified, profile_picture, hobbies, interests, current_activities, favorite_food, created_at)
VALUES 
  (
    'alex_smith', 
    'dummy_hashed_password_1', 
    'alex.smith@berkeley.edu',
    TRUE,
    'https://i.pravatar.cc/150?u=alex_smith',
    'Photography, Hiking, Reading',
    'Artificial Intelligence, Environmental Science, Modern Art',
    'Research assistant at the Computer Science department, Volunteer at campus sustainability club',
    'Thai curry, Sushi, Homemade pasta',
    NOW()
  ),
  (
    'emma_johnson', 
    'dummy_hashed_password_2', 
    'emma.j@stanford.edu',
    TRUE,
    'https://i.pravatar.cc/150?u=emma_johnson',
    'Piano, Yoga, Documentary filmmaking',
    'Neuroscience, Classical literature, Jazz music',
    'President of debate club, Working on research paper about cognitive development',
    'Mediterranean mezze, Seafood paella, Dark chocolate',
    NOW()
  ),
  (
    'michael_wang', 
    'dummy_hashed_password_3', 
    'mwang@mit.edu',
    TRUE,
    'https://i.pravatar.cc/150?u=michael_wang',
    'Basketball, Chess, Cooking',
    'Quantum computing, Financial markets, Urban planning',
    'Internship at tech startup, Captain of intramural basketball team',
    'Szechuan hot pot, Dim sum, Korean BBQ',
    NOW()
  ),
  (
    'sofia_garcia', 
    'dummy_hashed_password_4', 
    'sgarcia@ucla.edu',
    TRUE,
    'https://i.pravatar.cc/150?u=sofia_garcia',
    'Salsa dancing, Poetry writing, Painting',
    'Latin American literature, Public health, Sustainability',
    'Volunteering at local clinic, Editor for campus literary magazine',
    'Authentic tacos, Ceviche, Churros with chocolate',
    NOW()
  ),
  (
    'james_wilson', 
    'dummy_hashed_password_5', 
    'jwilson@nyu.edu',
    TRUE,
    'https://i.pravatar.cc/150?u=james_wilson',
    'DJing, Street photography, Skateboarding',
    'Urban culture, Electronic music, Documentary films',
    'Working part-time at record store, Running a podcast about city life',
    'New York pizza, Craft burgers, Ethiopian cuisine',
    NOW()
  ),
  (
    'olivia_chen', 
    'dummy_hashed_password_6', 
    'ochen@cornell.edu',
    TRUE,
    'https://i.pravatar.cc/150?u=olivia_chen',
    'Figure skating, Violin, Baking',
    'Molecular biology, Classical music, French cinema',
    'Research in biochemistry lab, Teaching assistant for introductory biology',
    'Japanese ramen, Fresh pastries, Matcha desserts',
    NOW()
  ),
  (
    'noah_patel', 
    'dummy_hashed_password_7', 
    'npatel@umich.edu',
    TRUE,
    'https://i.pravatar.cc/150?u=noah_patel',
    'Rock climbing, Podcast hosting, Coffee roasting',
    'Renewable energy, Machine learning, Contemporary fiction',
    'Leading clean energy student initiative, Developing ML algorithm for class project',
    'Indian street food, Wood-fired pizza, Specialty coffee',
    NOW()
  ),
  (
    'ava_robinson', 
    'dummy_hashed_password_8', 
    'arobinson@columbia.edu',
    TRUE,
    'https://i.pravatar.cc/150?u=ava_robinson',
    'Modern dance, Political activism, Vintage shopping',
    'International relations, Gender studies, Contemporary art',
    'Interning at non-profit, Choreographing for dance troupe',
    'Vegan cuisine, Middle Eastern mezze, Farm-to-table salads',
    NOW()
  ),
  (
    'ethan_nguyen', 
    'dummy_hashed_password_9', 
    'enguyen@ucdavis.edu',
    TRUE,
    'https://i.pravatar.cc/150?u=ethan_nguyen',
    'Mountain biking, Gardening, Amateur astronomy',
    'Agricultural science, Sustainable farming, Ecology',
    'Working at campus farm, Researching soil conservation',
    'Farm-fresh vegetables, Vietnamese pho, Artisanal cheese',
    NOW()
  ),
  (
    'zoe_miller', 
    'dummy_hashed_password_10', 
    'zmiller@uw.edu',
    TRUE,
    'https://i.pravatar.cc/150?u=zoe_miller',
    'Pottery, Hiking, Volunteering',
    'Marine biology, Climate activism, Indigenous art',
    'Field research in marine ecosystems, Organizing climate awareness events',
    'Sustainable seafood, Pacific Northwest cuisine, Foraged mushroom dishes',
    NOW()
  );
-- 1. Talent Profiles Table
CREATE TABLE IF NOT EXISTS talent_profiles (
    id SERIAL PRIMARY KEY,
    role_name VARCHAR(255) NOT NULL UNIQUE,
    stack_layer VARCHAR(100) NOT NULL, -- e.g., 'Layer 1 — Infrastructure', 'Domain (Vertical)'
    category VARCHAR(100) NOT NULL,     -- e.g., 'Engineering', 'Data Science', 'Domain SME'
    engagement_tier VARCHAR(100) NOT NULL, -- e.g., 'Full-Time (core)', 'Fractional'
    role_summary TEXT NOT NULL,
    red_flags TEXT NOT NULL,             -- Bullet points of critical screen-out triggers
    offerings TEXT,                     -- Specific offerings mapped to the role
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Candidates Table
CREATE TABLE IF NOT EXISTS candidates (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    linkedin_url VARCHAR(255),
    cv_raw_text TEXT,
    skills TEXT[] DEFAULT '{}',
    experience_years INT,
    is_blacklisted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. AI Assessments Table
CREATE TABLE IF NOT EXISTS assessments (
    id SERIAL PRIMARY KEY,
    candidate_id INT REFERENCES candidates(id) ON DELETE CASCADE,
    profile_id INT REFERENCES talent_profiles(id) ON DELETE CASCADE,
    match_score INT NOT NULL,           -- Range: 0 - 100
    skills_match TEXT[] DEFAULT '{}',
    skills_gap TEXT[] DEFAULT '{}',
    red_flags_detected TEXT[] DEFAULT '{}',
    ai_verdict TEXT,                    -- Multi-paragraph detailed analysis and decision rationale
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. SOW Projects Table
CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    sow_text TEXT,
    sow_filename VARCHAR(255),
    analysis_results JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

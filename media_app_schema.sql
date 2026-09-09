-- Media App Database Schema (PostgreSQL)
-- Version: 1.5

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

-- User roles
CREATE TYPE user_role AS ENUM (
    'Super Admin',
    'Leader',
    '2IC',
    'Volunteer',
    'New Lead'
);

-- User skill levels
CREATE TYPE skill_level AS ENUM (
    'Trainee',
    'Volunteer',
    'Trainer'
);

-- Department names
CREATE TYPE department_name AS ENUM (
    'Cameras',
    'Directors',
    'Link & Streaming',
    'Graphic Operators',
    'Comms'
);

-- Service sessions
CREATE TYPE service_session AS ENUM (
    'Sunday AM1 Pre-prayer',
    'Sunday AM1',
    'Sunday AM2 Pre-prayer',
    'Sunday AM2',
    'Sunday PM Pre-prayer',
    'Sunday PM',
    'Thursday Pre-prayer',
    'Thursday Training',
    'All'
);

-- Available days for transport
CREATE TYPE available_day AS ENUM (
    'Sunday',
    'Thursday',
    'Other'
);

-- Training progress status
CREATE TYPE training_status AS ENUM (
    'Not Started',
    'In Progress',
    'Completed'
);

-- RSVP status
CREATE TYPE rsvp_status AS ENUM (
    'Pending',
    'Accepted',
    'Declined'
);

-- Transport request status
CREATE TYPE transport_request_status AS ENUM (
    'Pending',
    'Accepted',
    'Declined',
    'Cancelled'
);

-- Attendance status
CREATE TYPE attendance_status AS ENUM (
    'Present',
    'Late',
    'Missing'
);

-- ============================================================================
-- TABLES
-- ============================================================================

-- Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(255) NOT NULL,
    surname VARCHAR(255) NOT NULL,
    nickname VARCHAR(255),
    email VARCHAR(255) NOT NULL UNIQUE,
    phone_number VARCHAR(20),
    area VARCHAR(255),
    role user_role NOT NULL,
    skill_level skill_level NOT NULL,
    department_id UUID,
    assigned_member_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by UUID,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by UUID
);

-- Departments Table
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name department_name NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by UUID,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by UUID
);

-- Positions Table
CREATE TABLE positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by UUID,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by UUID,
    CONSTRAINT fk_positions_department FOREIGN KEY (department_id) REFERENCES departments(id),
    CONSTRAINT fk_positions_created_by FOREIGN KEY (created_by) REFERENCES users(id),
    CONSTRAINT fk_positions_updated_by FOREIGN KEY (updated_by) REFERENCES users(id)
);

-- Onboarding_Pipeline Table
CREATE TABLE onboarding_pipeline (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    form_submission_date TIMESTAMP NOT NULL,
    assigned_contact_id UUID,
    feedback_notes TEXT,
    tour_scheduled_date TIMESTAMP,
    tour_completed BOOLEAN DEFAULT FALSE,
    no_show_tour BOOLEAN DEFAULT FALSE,
    joining_other_department BOOLEAN DEFAULT FALSE,
    other_department_name VARCHAR(255),
    mini_onboarding_completed BOOLEAN DEFAULT FALSE,
    assigned_department_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by UUID,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by UUID,
    CONSTRAINT fk_onboarding_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_onboarding_assigned_contact FOREIGN KEY (assigned_contact_id) REFERENCES users(id),
    CONSTRAINT fk_onboarding_department FOREIGN KEY (assigned_department_id) REFERENCES departments(id),
    CONSTRAINT fk_onboarding_created_by FOREIGN KEY (created_by) REFERENCES users(id),
    CONSTRAINT fk_onboarding_updated_by FOREIGN KEY (updated_by) REFERENCES users(id)
);

-- Transport_Availability Table
CREATE TABLE transport_availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_user_id UUID NOT NULL,
    area VARCHAR(255) NOT NULL,
    available_day available_day NOT NULL,
    service_session service_session NOT NULL,
    seats_available INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by UUID,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by UUID,
    CONSTRAINT fk_transport_avail_driver FOREIGN KEY (driver_user_id) REFERENCES users(id),
    CONSTRAINT fk_transport_avail_created_by FOREIGN KEY (created_by) REFERENCES users(id),
    CONSTRAINT fk_transport_avail_updated_by FOREIGN KEY (updated_by) REFERENCES users(id)
);

-- Transport_Requests Table
CREATE TABLE transport_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_user_id UUID NOT NULL,
    driver_availability_id UUID NOT NULL,
    request_date DATE NOT NULL,
    service_session service_session NOT NULL,
    pickup_area VARCHAR(255) NOT NULL,
    status transport_request_status DEFAULT 'Pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by UUID,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by UUID,
    CONSTRAINT fk_transport_req_requester FOREIGN KEY (requester_user_id) REFERENCES users(id),
    CONSTRAINT fk_transport_req_availability FOREIGN KEY (driver_availability_id) REFERENCES transport_availability(id),
    CONSTRAINT fk_transport_req_created_by FOREIGN KEY (created_by) REFERENCES users(id),
    CONSTRAINT fk_transport_req_updated_by FOREIGN KEY (updated_by) REFERENCES users(id)
);

-- Training_Modules Table
CREATE TABLE training_modules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    department_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    content_body TEXT,
    step_order INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by UUID,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by UUID,
    CONSTRAINT fk_training_modules_department FOREIGN KEY (department_id) REFERENCES departments(id),
    CONSTRAINT fk_training_modules_created_by FOREIGN KEY (created_by) REFERENCES users(id),
    CONSTRAINT fk_training_modules_updated_by FOREIGN KEY (updated_by) REFERENCES users(id)
);

-- User_Training_Progress Table
CREATE TABLE user_training_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    module_id UUID NOT NULL,
    status training_status DEFAULT 'Not Started',
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by UUID,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by UUID,
    CONSTRAINT fk_user_training_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_user_training_module FOREIGN KEY (module_id) REFERENCES training_modules(id),
    CONSTRAINT fk_user_training_created_by FOREIGN KEY (created_by) REFERENCES users(id),
    CONSTRAINT fk_user_training_updated_by FOREIGN KEY (updated_by) REFERENCES users(id),
    UNIQUE(user_id, module_id)
);

-- Rosters_Shifts Table
CREATE TABLE rosters_shifts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    position_id UUID NOT NULL,
    user_id UUID NOT NULL,
    shift_date DATE NOT NULL,
    service_session service_session NOT NULL,
    rsvp_status rsvp_status DEFAULT 'Pending',
    calendar_event_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by UUID,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by UUID,
    CONSTRAINT fk_rosters_position FOREIGN KEY (position_id) REFERENCES positions(id),
    CONSTRAINT fk_rosters_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_rosters_created_by FOREIGN KEY (created_by) REFERENCES users(id),
    CONSTRAINT fk_rosters_updated_by FOREIGN KEY (updated_by) REFERENCES users(id)
);

-- Attendance Table
CREATE TABLE attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shift_id UUID NOT NULL,
    user_id UUID NOT NULL,
    check_in_time TIMESTAMP,
    status attendance_status NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by UUID,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_by UUID,
    CONSTRAINT fk_attendance_shift FOREIGN KEY (shift_id) REFERENCES rosters_shifts(id),
    CONSTRAINT fk_attendance_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_attendance_created_by FOREIGN KEY (created_by) REFERENCES users(id),
    CONSTRAINT fk_attendance_updated_by FOREIGN KEY (updated_by) REFERENCES users(id),
    UNIQUE(shift_id, user_id)
);

-- ============================================================================
-- FOREIGN KEYS FOR USERS TABLE (added after all tables created)
-- ============================================================================

ALTER TABLE users ADD CONSTRAINT fk_users_department 
    FOREIGN KEY (department_id) REFERENCES departments(id);

ALTER TABLE users ADD CONSTRAINT fk_users_assigned_member 
    FOREIGN KEY (assigned_member_id) REFERENCES users(id);

ALTER TABLE users ADD CONSTRAINT fk_users_created_by 
    FOREIGN KEY (created_by) REFERENCES users(id);

ALTER TABLE users ADD CONSTRAINT fk_users_updated_by 
    FOREIGN KEY (updated_by) REFERENCES users(id);

-- ============================================================================
-- INDEXES (Performance optimization)
-- ============================================================================

-- Users indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_department_id ON users(department_id);
CREATE INDEX idx_users_assigned_member_id ON users(assigned_member_id);
CREATE INDEX idx_users_role ON users(role);

-- Onboarding Pipeline indexes
CREATE INDEX idx_onboarding_user_id ON onboarding_pipeline(user_id);
CREATE INDEX idx_onboarding_assigned_contact_id ON onboarding_pipeline(assigned_contact_id);
CREATE INDEX idx_onboarding_department_id ON onboarding_pipeline(assigned_department_id);

-- Transport Availability indexes
CREATE INDEX idx_transport_avail_driver ON transport_availability(driver_user_id);
CREATE INDEX idx_transport_avail_area ON transport_availability(area);
CREATE INDEX idx_transport_avail_active ON transport_availability(is_active);

-- Transport Requests indexes
CREATE INDEX idx_transport_req_requester ON transport_requests(requester_user_id);
CREATE INDEX idx_transport_req_availability ON transport_requests(driver_availability_id);
CREATE INDEX idx_transport_req_status ON transport_requests(status);
CREATE INDEX idx_transport_req_date ON transport_requests(request_date);

-- Training indexes
CREATE INDEX idx_training_modules_department ON training_modules(department_id);
CREATE INDEX idx_user_training_user_id ON user_training_progress(user_id);
CREATE INDEX idx_user_training_module_id ON user_training_progress(module_id);
CREATE INDEX idx_user_training_status ON user_training_progress(status);

-- Rosters/Shifts indexes
CREATE INDEX idx_rosters_position_id ON rosters_shifts(position_id);
CREATE INDEX idx_rosters_user_id ON rosters_shifts(user_id);
CREATE INDEX idx_rosters_shift_date ON rosters_shifts(shift_date);
CREATE INDEX idx_rosters_rsvp_status ON rosters_shifts(rsvp_status);

-- Attendance indexes
CREATE INDEX idx_attendance_shift_id ON attendance(shift_id);
CREATE INDEX idx_attendance_user_id ON attendance(user_id);
CREATE INDEX idx_attendance_status ON attendance(status);

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE users IS 'Core user management table for all system users';
COMMENT ON TABLE departments IS 'Media department definitions (Cameras, Directors, etc.)';
COMMENT ON TABLE positions IS 'Specific positions within departments';
COMMENT ON TABLE onboarding_pipeline IS 'Tracks new user onboarding status and progress';
COMMENT ON TABLE transport_availability IS 'Available transport offers from drivers';
COMMENT ON TABLE transport_requests IS 'Transport requests from users to drivers';
COMMENT ON TABLE training_modules IS 'Training content organized by department';
COMMENT ON TABLE user_training_progress IS 'Tracks user progress through training modules';
COMMENT ON TABLE rosters_shifts IS 'Scheduled shifts for positions';
COMMENT ON TABLE attendance IS 'Attendance records for scheduled shifts';

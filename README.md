# AthLion
Étrend számláló és ajánló, mesterséges intelligencia alapú edzésterv összeállító webapp

Relációs adatbázis terv ( !xxxx! = primary key):
USER(!user_id!, name, date_of_birth, height_cm, sex, email) 
HEALTH_CONDITION(!condition_id!, name) 
USER_CONDITION(USER.user_id, HEALTH_CONDITION.condition_id, note) 
MEDICATION(!med_id!, name)  
USER_MEDICATION(USER.user_id, MEDICATION.med_id, dosage, schedule_note) 
ALLERGEN(!allergen_id!, name) 
USER_ALLERGY(USER.user_id, ALLERGEN.allergen_id, severity, note) 
INJURY(!injury_id!, name) 
USER_INJURY(USER.user_id, INJURY.injury_id, status, note) 
DIET_PROFILE(!diet_id!, USER.user_id, START_STATE.start_id, diet_type, is_active) 
TRAINING_PROFILE(!training_id!, USER.user_id, START_STATE.start_id, load_level, program_time, 
preference, is_active) 
START_STATE(!start_id!, start_weight_kg, target_weight_kg, goal_type, motivation_goal, created_at) 

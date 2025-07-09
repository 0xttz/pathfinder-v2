#!/usr/bin/env python3
"""
Data Migration Script for Content Sources

This script migrates existing reflections and texts into the new content_sources table
while maintaining data integrity and relationships.
"""

import asyncio
import logging
import os
import sys

# Add the parent directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from supabase import create_client, Client
from core.config import settings
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DataMigrator:
    """Migrates existing data to new content sources structure."""
    
    def __init__(self):
        """Initialize the migrator with database connection."""
        self.db: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    
    async def migrate_reflections_to_content_sources(self):
        """Migrate existing reflections to content_sources table."""
        logger.info("Starting migration of reflections to content_sources...")
        
        try:
            # Get all answered reflections
            reflections_response = self.db.table('reflections').select('*').neq('answer', None).execute()
            reflections = reflections_response.data
            
            logger.info(f"Found {len(reflections)} answered reflections to migrate")
            
            migrated_count = 0
            for reflection in reflections:
                try:
                    # Check if already migrated (avoid duplicates)
                    existing_check = self.db.table('content_sources').select('id').eq(
                        'metadata->>reflection_id', reflection['id']
                    ).execute()
                    
                    if existing_check.data:
                        logger.info(f"Reflection {reflection['id']} already migrated, skipping...")
                        continue
                    
                    # Create content source from reflection
                    content_source_data = {
                        'realm_id': reflection['realm_id'],
                        'source_type': 'reflection',
                        'title': reflection['question'][:100] + '...' if len(reflection['question']) > 100 else reflection['question'],
                        'content': f"Q: {reflection['question']}\n\nA: {reflection['answer']}",
                        'metadata': {
                            'reflection_id': reflection['id'],
                            'original_question': reflection['question'],
                            'migrated_at': datetime.utcnow().isoformat()
                        },
                        'weight': 1.0,  # Default weight
                        'created_at': reflection.get('created_at', datetime.utcnow().isoformat())
                    }
                    
                    result = self.db.table('content_sources').insert(content_source_data).execute()
                    if result.data:
                        migrated_count += 1
                        logger.info(f"Migrated reflection {reflection['id']} to content source")
                    else:
                        logger.error(f"Failed to migrate reflection {reflection['id']}: No data returned")
                        
                except Exception as e:
                    logger.error(f"Error migrating reflection {reflection['id']}: {str(e)}")
                    continue
            
            logger.info(f"Successfully migrated {migrated_count} reflections to content_sources")
            return migrated_count
            
        except Exception as e:
            logger.error(f"Error during reflection migration: {str(e)}")
            return 0
    
    async def migrate_texts_to_content_sources(self):
        """Migrate existing texts to content_sources table."""
        logger.info("Starting migration of texts to content_sources...")
        
        try:
            # Get all texts
            texts_response = self.db.table('texts').select('*').execute()
            texts = texts_response.data
            
            logger.info(f"Found {len(texts)} texts to migrate")
            
            migrated_count = 0
            for text in texts:
                try:
                    # Skip empty texts
                    if not text['content'] or len(text['content'].strip()) < 10:
                        logger.info(f"Skipping empty text {text['id']}")
                        continue
                    
                    # Check if already migrated (avoid duplicates)
                    existing_check = self.db.table('content_sources').select('id').eq(
                        'metadata->>text_id', text['id']
                    ).execute()
                    
                    if existing_check.data:
                        logger.info(f"Text {text['id']} already migrated, skipping...")
                        continue
                    
                    # Create content source from text (no realm assignment initially)
                    content_source_data = {
                        'realm_id': None,  # Texts start unassigned
                        'source_type': 'text',
                        'title': text['title'],
                        'content': text['content'],
                        'metadata': {
                            'text_id': text['id'],
                            'word_count': len(text['content'].split()),
                            'migrated_at': datetime.utcnow().isoformat()
                        },
                        'weight': 1.0,  # Default weight
                        'created_at': text.get('created_at', datetime.utcnow().isoformat())
                    }
                    
                    result = self.db.table('content_sources').insert(content_source_data).execute()
                    if result.data:
                        migrated_count += 1
                        logger.info(f"Migrated text {text['id']} to content source")
                    else:
                        logger.error(f"Failed to migrate text {text['id']}: No data returned")
                        
                except Exception as e:
                    logger.error(f"Error migrating text {text['id']}: {str(e)}")
                    continue
            
            logger.info(f"Successfully migrated {migrated_count} texts to content_sources")
            return migrated_count
            
        except Exception as e:
            logger.error(f"Error during text migration: {str(e)}")
            return 0
    
    async def create_default_prompt_versions(self):
        """Create initial prompt versions for existing realms."""
        logger.info("Creating default prompt versions for existing realms...")
        
        try:
            # Get all realms
            realms_response = self.db.table('realms').select('*').execute()
            realms = realms_response.data
            
            logger.info(f"Found {len(realms)} realms to create prompt versions for")
            
            created_count = 0
            for realm in realms:
                try:
                    # Check if prompt version already exists
                    existing_check = self.db.table('prompt_versions').select('id').eq(
                        'realm_id', realm['id']
                    ).execute()
                    
                    if existing_check.data:
                        logger.info(f"Prompt version for realm {realm['id']} already exists, skipping...")
                        continue
                    
                    # Create initial prompt version
                    prompt_version_data = {
                        'realm_id': realm['id'],
                        'version_number': 1,
                        'content': realm.get('system_prompt', ''),
                        'synthesis_method': 'legacy',
                        'quality_score': None,
                        'effectiveness_metrics': {},
                        'created_at': realm.get('created_at', datetime.utcnow().isoformat())
                    }
                    
                    result = self.db.table('prompt_versions').insert(prompt_version_data).execute()
                    if result.data:
                        created_count += 1
                        logger.info(f"Created prompt version for realm {realm['id']}")
                    else:
                        logger.error(f"Failed to create prompt version for realm {realm['id']}: No data returned")
                        
                except Exception as e:
                    logger.error(f"Error creating prompt version for realm {realm['id']}: {str(e)}")
                    continue
            
            logger.info(f"Successfully created {created_count} prompt versions")
            return created_count
            
        except Exception as e:
            logger.error(f"Error during prompt version creation: {str(e)}")
            return 0
    
    async def update_realm_current_versions(self):
        """Update realm current_version fields."""
        logger.info("Updating realm current_version fields...")
        
        try:
            # Get all realms
            realms_response = self.db.table('realms').select('*').execute()
            realms = realms_response.data
            
            updated_count = 0
            for realm in realms:
                try:
                    if realm.get('current_version') is None:
                        result = self.db.table('realms').update({
                            'current_version': 1
                        }).eq('id', realm['id']).execute()
                        
                        if result.data:
                            updated_count += 1
                            logger.info(f"Updated current_version for realm {realm['id']}")
                        
                except Exception as e:
                    logger.error(f"Error updating realm {realm['id']}: {str(e)}")
                    continue
            
            logger.info(f"Successfully updated {updated_count} realm current_version fields")
            return updated_count
            
        except Exception as e:
            logger.error(f"Error during realm update: {str(e)}")
            return 0
    
    async def run_complete_migration(self):
        """Run the complete data migration process."""
        logger.info("=== Starting Complete Data Migration ===")
        
        try:
            # Step 1: Migrate reflections
            reflection_count = await self.migrate_reflections_to_content_sources()
            
            # Step 2: Migrate texts
            text_count = await self.migrate_texts_to_content_sources()
            
            # Step 3: Create prompt versions
            prompt_version_count = await self.create_default_prompt_versions()
            
            # Step 4: Update realm versions
            realm_update_count = await self.update_realm_current_versions()
            
            logger.info("=== Migration Summary ===")
            logger.info(f"Reflections migrated: {reflection_count}")
            logger.info(f"Texts migrated: {text_count}")
            logger.info(f"Prompt versions created: {prompt_version_count}")
            logger.info(f"Realms updated: {realm_update_count}")
            logger.info("=== Migration Completed Successfully ===")
            
            return {
                'reflections': reflection_count,
                'texts': text_count,
                'prompt_versions': prompt_version_count,
                'realms_updated': realm_update_count
            }
            
        except Exception as e:
            logger.error(f"Migration failed: {str(e)}")
            raise

async def main():
    """Main function to run the migration."""
    migrator = DataMigrator()
    try:
        results = await migrator.run_complete_migration()
        print("\n✅ Data migration completed successfully!")
        print(f"📊 Summary: {results}")
    except Exception as e:
        print(f"\n❌ Migration failed: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main()) 
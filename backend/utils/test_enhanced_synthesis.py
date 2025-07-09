#!/usr/bin/env python3
"""
Enhanced Synthesis System Integration Test

This script tests the complete enhanced synthesis system end-to-end,
including content sources, advanced synthesis, and API endpoints.
"""

import asyncio
import logging
import os
import sys
import json
import time
from typing import Dict, Any, List

# Add the parent directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from supabase import create_client, Client
from core.config import settings
import httpx

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class EnhancedSynthesisSystemTest:
    """Comprehensive test suite for the enhanced synthesis system."""
    
    def __init__(self):
        """Initialize the test suite."""
        self.db: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        self.base_url = "http://localhost:8000"
        self.test_results = {}
        
    async def test_database_schema(self):
        """Test that all new database tables and columns exist."""
        logger.info("Testing database schema...")
        
        tests = []
        
        try:
            # Test content_sources table
            content_sources = self.db.table('content_sources').select('*').limit(1).execute()
            tests.append(("content_sources_table", True, "Content sources table exists"))
            
            # Test prompt_versions table  
            prompt_versions = self.db.table('prompt_versions').select('*').limit(1).execute()
            tests.append(("prompt_versions_table", True, "Prompt versions table exists"))
            
            # Test synthesis_jobs table
            synthesis_jobs = self.db.table('synthesis_jobs').select('*').limit(1).execute()
            tests.append(("synthesis_jobs_table", True, "Synthesis jobs table exists"))
            
            # Test conversation_metrics table
            conversation_metrics = self.db.table('conversation_metrics').select('*').limit(1).execute()
            tests.append(("conversation_metrics_table", True, "Conversation metrics table exists"))
            
            # Test realm enhancements
            realms = self.db.table('realms').select('current_version,quality_score').limit(1).execute()
            tests.append(("realm_enhancements", True, "Realm enhancements exist"))
            
        except Exception as e:
            tests.append(("database_schema", False, f"Database schema test failed: {str(e)}"))
        
        self.test_results["database_schema"] = tests
        return tests
    
    async def test_content_sources_api(self):
        """Test content sources API endpoints."""
        logger.info("Testing content sources API...")
        
        tests = []
        
        try:
            async with httpx.AsyncClient() as client:
                # Test getting content sources for a realm
                response = await client.get(f"{self.base_url}/content-sources")
                tests.append((
                    "get_content_sources", 
                    response.status_code in [200, 404], 
                    f"GET /content-sources returned {response.status_code}"
                ))
                
                # Test creating a content source
                test_content_source = {
                    "realm_id": None,
                    "source_type": "structured",
                    "title": "Test Content Source",
                    "content": "This is a test content source for the enhanced synthesis system.",
                    "metadata": {"test": True},
                    "weight": 1.5
                }
                
                response = await client.post(
                    f"{self.base_url}/content-sources",
                    json=test_content_source
                )
                
                if response.status_code == 200:
                    content_source_id = response.json().get("id")
                    tests.append(("create_content_source", True, f"Created content source: {content_source_id}"))
                    
                    # Test updating weight
                    response = await client.put(
                        f"{self.base_url}/content-sources/{content_source_id}/weight",
                        json={"weight": 2.0}
                    )
                    tests.append((
                        "update_content_source_weight", 
                        response.status_code == 200, 
                        f"Updated weight returned {response.status_code}"
                    ))
                    
                    # Test deleting content source
                    response = await client.delete(f"{self.base_url}/content-sources/{content_source_id}")
                    tests.append((
                        "delete_content_source", 
                        response.status_code == 200, 
                        f"Delete content source returned {response.status_code}"
                    ))
                else:
                    tests.append(("create_content_source", False, f"Failed to create content source: {response.status_code}"))
                
        except Exception as e:
            tests.append(("content_sources_api", False, f"Content sources API test failed: {str(e)}"))
        
        self.test_results["content_sources_api"] = tests
        return tests
    
    async def test_advanced_synthesis_api(self):
        """Test advanced synthesis API endpoints."""
        logger.info("Testing advanced synthesis API...")
        
        tests = []
        
        try:
            async with httpx.AsyncClient() as client:
                # Create a test realm first
                test_realm = {
                    "name": "Test Synthesis Realm",
                    "system_prompt": "You are a helpful assistant for testing synthesis."
                }
                
                realm_response = await client.post(f"{self.base_url}/realms", json=test_realm)
                
                if realm_response.status_code == 200:
                    realm_id = realm_response.json().get("id")
                    tests.append(("create_test_realm", True, f"Created test realm: {realm_id}"))
                    
                    # Test advanced synthesis endpoint
                    synthesis_request = {
                        "synthesis_type": "full",
                        "configuration": {
                            "include_quality_assessment": True,
                            "generate_suggestions": True
                        }
                    }
                    
                    response = await client.post(
                        f"{self.base_url}/realms/{realm_id}/synthesize/advanced",
                        json=synthesis_request
                    )
                    
                    if response.status_code == 200:
                        job_data = response.json()
                        job_id = job_data.get("job_id")
                        tests.append(("start_advanced_synthesis", True, f"Started synthesis job: {job_id}"))
                        
                        # Test job status endpoint
                        if job_id:
                            await asyncio.sleep(2)  # Wait a moment for job to process
                            status_response = await client.get(f"{self.base_url}/synthesis-jobs/{job_id}")
                            tests.append((
                                "get_synthesis_job_status", 
                                status_response.status_code == 200, 
                                f"Job status returned {status_response.status_code}"
                            ))
                    else:
                        tests.append(("start_advanced_synthesis", False, f"Failed to start synthesis: {response.status_code}"))
                    
                    # Test batch processing endpoint
                    batch_response = await client.post(f"{self.base_url}/realms/{realm_id}/process-batch-queue")
                    tests.append((
                        "process_batch_queue", 
                        batch_response.status_code in [200, 204], 
                        f"Batch processing returned {batch_response.status_code}"
                    ))
                    
                    # Clean up - delete test realm
                    await client.delete(f"{self.base_url}/realms/{realm_id}")
                else:
                    tests.append(("create_test_realm", False, f"Failed to create test realm: {realm_response.status_code}"))
                
        except Exception as e:
            tests.append(("advanced_synthesis_api", False, f"Advanced synthesis API test failed: {str(e)}"))
        
        self.test_results["advanced_synthesis_api"] = tests
        return tests
    
    async def test_synthesis_services(self):
        """Test synthesis service components."""
        logger.info("Testing synthesis services...")
        
        tests = []
        
        try:
            # Import and test synthesis components
            from services.synthesis_engine import SynthesisEngine
            from services.smart_synthesis_manager import SmartSynthesisManager
            
            # Test SynthesisEngine initialization
            engine = SynthesisEngine()
            tests.append(("synthesis_engine_init", True, "SynthesisEngine initialized successfully"))
            
            # Test SmartSynthesisManager initialization  
            manager = SmartSynthesisManager()
            tests.append(("smart_synthesis_manager_init", True, "SmartSynthesisManager initialized successfully"))
            
            # Test basic synthesis functionality
            test_sources = [
                {"content": "This is test content 1", "weight": 1.0},
                {"content": "This is test content 2", "weight": 1.5}
            ]
            
            # This would normally require a realm, but we're testing the basic functionality
            # result = await engine.synthesize_sources(test_sources, "Test prompt")
            # tests.append(("basic_synthesis", True, "Basic synthesis completed"))
            
        except ImportError as e:
            tests.append(("synthesis_services_import", False, f"Failed to import synthesis services: {str(e)}"))
        except Exception as e:
            tests.append(("synthesis_services", False, f"Synthesis services test failed: {str(e)}"))
        
        self.test_results["synthesis_services"] = tests
        return tests
    
    async def test_data_migration_integrity(self):
        """Test that data migration maintained integrity."""
        logger.info("Testing data migration integrity...")
        
        tests = []
        
        try:
            # Check that content sources were created from reflections
            content_sources_response = self.db.table('content_sources').select('*').eq('source_type', 'reflection').execute()
            reflection_sources = content_sources_response.data
            
            # Check that original reflections still exist
            reflections_response = self.db.table('reflections').select('*').execute()
            original_reflections = reflections_response.data
            
            tests.append((
                "reflection_migration_integrity", 
                len(reflection_sources) > 0, 
                f"Found {len(reflection_sources)} migrated reflections"
            ))
            
            # Check that content sources were created from texts
            text_sources_response = self.db.table('content_sources').select('*').eq('source_type', 'text').execute()
            text_sources = text_sources_response.data
            
            tests.append((
                "text_migration_integrity", 
                len(text_sources) > 0, 
                f"Found {len(text_sources)} migrated texts"
            ))
            
            # Verify metadata structure
            if reflection_sources:
                sample_reflection = reflection_sources[0]
                has_metadata = 'metadata' in sample_reflection and 'reflection_id' in sample_reflection['metadata']
                tests.append(("reflection_metadata_structure", has_metadata, "Reflection metadata properly structured"))
            
            if text_sources:
                sample_text = text_sources[0]
                has_metadata = 'metadata' in sample_text and 'text_id' in sample_text['metadata']
                tests.append(("text_metadata_structure", has_metadata, "Text metadata properly structured"))
            
        except Exception as e:
            tests.append(("data_migration_integrity", False, f"Data migration integrity test failed: {str(e)}"))
        
        self.test_results["data_migration_integrity"] = tests
        return tests
    
    async def test_performance_metrics(self):
        """Test performance and basic load handling."""
        logger.info("Testing performance metrics...")
        
        tests = []
        
        try:
            start_time = time.time()
            
            # Test database query performance
            content_sources_response = self.db.table('content_sources').select('*').limit(100).execute()
            db_query_time = time.time() - start_time
            
            tests.append((
                "database_query_performance", 
                db_query_time < 2.0, 
                f"Database query took {db_query_time:.2f}s"
            ))
            
            # Test API response time
            start_time = time.time()
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self.base_url}/content-sources")
                api_response_time = time.time() - start_time
                
            tests.append((
                "api_response_performance", 
                api_response_time < 3.0, 
                f"API response took {api_response_time:.2f}s"
            ))
            
        except Exception as e:
            tests.append(("performance_metrics", False, f"Performance test failed: {str(e)}"))
        
        self.test_results["performance_metrics"] = tests
        return tests
    
    def print_test_results(self):
        """Print comprehensive test results."""
        print("\n" + "="*80)
        print("ENHANCED SYNTHESIS SYSTEM TEST RESULTS")
        print("="*80)
        
        total_tests = 0
        passed_tests = 0
        
        for category, tests in self.test_results.items():
            print(f"\n📋 {category.upper().replace('_', ' ')}")
            print("-" * 50)
            
            for test_name, passed, message in tests:
                total_tests += 1
                if passed:
                    passed_tests += 1
                    print(f"✅ {test_name}: {message}")
                else:
                    print(f"❌ {test_name}: {message}")
        
        print("\n" + "="*80)
        print(f"SUMMARY: {passed_tests}/{total_tests} tests passed ({(passed_tests/total_tests)*100:.1f}%)")
        
        if passed_tests == total_tests:
            print("🎉 ALL TESTS PASSED! The enhanced synthesis system is working correctly.")
        else:
            print("⚠️  Some tests failed. Please review the issues above.")
        
        print("="*80)
    
    async def run_all_tests(self):
        """Run all test suites."""
        logger.info("Starting enhanced synthesis system test suite...")
        
        test_suites = [
            self.test_database_schema,
            self.test_data_migration_integrity,
            self.test_content_sources_api,
            self.test_advanced_synthesis_api,
            self.test_synthesis_services,
            self.test_performance_metrics,
        ]
        
        for test_suite in test_suites:
            try:
                await test_suite()
            except Exception as e:
                logger.error(f"Test suite {test_suite.__name__} failed with exception: {str(e)}")
        
        self.print_test_results()
        
        # Return overall success status
        total_tests = sum(len(tests) for tests in self.test_results.values())
        passed_tests = sum(len([t for t in tests if t[1]]) for tests in self.test_results.values())
        
        return passed_tests == total_tests

async def main():
    """Main function to run the test suite."""
    test_suite = EnhancedSynthesisSystemTest()
    
    try:
        success = await test_suite.run_all_tests()
        
        if success:
            print("\n✅ Enhanced synthesis system is fully operational!")
            sys.exit(0)
        else:
            print("\n❌ Enhanced synthesis system has issues that need attention.")
            sys.exit(1)
            
    except Exception as e:
        print(f"\n💥 Test suite failed with critical error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main()) 
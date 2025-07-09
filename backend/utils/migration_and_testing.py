#!/usr/bin/env python3
"""
Pathfinder Synthesis Enhancement Migration & Testing Utility

This script helps migrate existing data to the new content sources system
and provides comprehensive testing of the enhanced synthesis features.
"""

import asyncio
import requests
import json
from datetime import datetime
from typing import List, Dict, Any, Optional

# Configuration
BASE_URL = "http://localhost:8000"

class PathfinderMigrationTester:
    """Utility class for migrating data and testing the enhanced synthesis system."""
    
    def __init__(self, base_url: str = BASE_URL):
        self.base_url = base_url
        self.session = requests.Session()
    
    def print_header(self, title: str):
        """Print a formatted header."""
        print(f"\n{'='*60}")
        print(f"  {title}")
        print(f"{'='*60}")
    
    def print_step(self, step: str):
        """Print a formatted step."""
        print(f"\n🔄 {step}")
    
    def print_success(self, message: str):
        """Print a success message."""
        print(f"✅ {message}")
    
    def print_error(self, message: str):
        """Print an error message."""
        print(f"❌ {message}")
    
    def print_info(self, message: str):
        """Print an info message."""
        print(f"ℹ️  {message}")
    
    # Migration Functions
    def migrate_reflections_to_content_sources(self, realm_id: Optional[str] = None) -> Dict[str, Any]:
        """Migrate existing reflections to content sources."""
        self.print_step("Migrating reflections to content sources...")
        
        endpoint = f"{self.base_url}/content-sources/migrate-from-reflections"
        params = {"realm_id": realm_id} if realm_id else {}
        
        try:
            response = self.session.post(endpoint, params=params)
            response.raise_for_status()
            result = response.json()
            
            self.print_success(f"Migrated {result['migrated_count']} reflections")
            return result
        except Exception as e:
            self.print_error(f"Failed to migrate reflections: {e}")
            return {"migrated_count": 0, "error": str(e)}
    
    def migrate_texts_to_content_sources(self) -> Dict[str, Any]:
        """Migrate existing texts to content sources."""
        self.print_step("Migrating texts to content sources...")
        
        endpoint = f"{self.base_url}/content-sources/migrate-from-texts"
        
        try:
            response = self.session.post(endpoint)
            response.raise_for_status()
            result = response.json()
            
            self.print_success(f"Migrated {result['migrated_count']} texts")
            return result
        except Exception as e:
            self.print_error(f"Failed to migrate texts: {e}")
            return {"migrated_count": 0, "error": str(e)}
    
    # Testing Functions
    def test_content_sources_api(self) -> bool:
        """Test the content sources API endpoints."""
        self.print_step("Testing Content Sources API...")
        
        try:
            # Test GET all content sources
            response = self.session.get(f"{self.base_url}/content-sources")
            response.raise_for_status()
            sources = response.json()
            self.print_success(f"Retrieved {len(sources)} content sources")
            
            if sources:
                # Test GET specific content source
                source_id = sources[0]["id"]
                response = self.session.get(f"{self.base_url}/content-sources/{source_id}")
                response.raise_for_status()
                self.print_success("Successfully retrieved individual content source")
                
                # Test content source analysis
                response = self.session.post(f"{self.base_url}/content-sources/{source_id}/analyze")
                if response.status_code == 200:
                    analysis = response.json()
                    self.print_success(f"Content analysis successful - Quality Score: {analysis.get('quality_score', 'N/A')}")
                else:
                    self.print_info("Content analysis API not fully configured (requires Gemini API key)")
            
            return True
        except Exception as e:
            self.print_error(f"Content Sources API test failed: {e}")
            return False
    
    async def test_advanced_synthesis(self, realm_id: str) -> Optional[str]:
        """Test the advanced synthesis system."""
        self.print_step(f"Testing Advanced Synthesis for realm {realm_id}...")
        
        try:
            # Check if realm has content sources
            response = self.session.get(f"{self.base_url}/realms/{realm_id}/content-sources")
            response.raise_for_status()
            content_sources = response.json()
            
            if not content_sources:
                self.print_error("No content sources found for this realm. Run migration first.")
                return None
            
            self.print_info(f"Found {len(content_sources)} content sources for synthesis")
            
            # Start advanced synthesis
            synthesis_request = {
                "realm_id": realm_id,
                "synthesis_type": "full",
                "configuration": {
                    "focus_areas": ["persona_traits", "communication_style"],
                    "quality_threshold": 0.7
                }
            }
            
            response = self.session.post(
                f"{self.base_url}/realms/{realm_id}/synthesize/advanced",
                json=synthesis_request
            )
            response.raise_for_status()
            job_info = response.json()
            
            job_id = job_info["job_id"]
            self.print_success(f"Started synthesis job: {job_id}")
            
            # Monitor job status
            max_attempts = 12  # Wait up to 60 seconds
            for attempt in range(max_attempts):
                await asyncio.sleep(5)  # Wait 5 seconds
                
                response = self.session.get(f"{self.base_url}/synthesis-jobs/{job_id}")
                response.raise_for_status()
                job_status = response.json()
                
                status = job_status["status"]
                self.print_info(f"Job status: {status}")
                
                if status == "completed":
                    self.print_success("Synthesis completed successfully!")
                    quality_score = job_status.get("quality_analysis", {}).get("quality_assessment", {}).get("overall_quality", "Unknown")
                    self.print_info(f"Quality Score: {quality_score}")
                    return job_status.get("result_prompt")
                elif status == "failed":
                    error_msg = job_status.get("error_message", "Unknown error")
                    self.print_error(f"Synthesis failed: {error_msg}")
                    return None
            
            self.print_error("Synthesis job timed out")
            return None
            
        except Exception as e:
            self.print_error(f"Advanced synthesis test failed: {e}")
            return None
    
    def test_content_analysis(self, realm_id: str) -> Dict[str, Any]:
        """Test content analysis for a realm."""
        self.print_step(f"Testing Content Analysis for realm {realm_id}...")
        
        try:
            response = self.session.get(f"{self.base_url}/realms/{realm_id}/content-analysis")
            response.raise_for_status()
            analysis = response.json()
            
            if "analysis" in analysis:
                themes = analysis["analysis"].get("themes", [])
                traits = analysis["analysis"].get("persona_traits", [])
                quality_score = analysis["analysis"].get("quality_score", 0)
                
                self.print_success("Content analysis completed")
                self.print_info(f"Themes identified: {len(themes)}")
                self.print_info(f"Persona traits: {len(traits)}")
                self.print_info(f"Quality score: {quality_score}")
                
                if themes:
                    print(f"  📋 Top themes: {', '.join(themes[:3])}")
                if traits:
                    print(f"  👤 Key traits: {', '.join(traits[:3])}")
            
            return analysis
        except Exception as e:
            self.print_error(f"Content analysis test failed: {e}")
            return {}
    
    def get_available_realms(self) -> List[Dict[str, Any]]:
        """Get list of available realms."""
        try:
            response = self.session.get(f"{self.base_url}/realms")
            response.raise_for_status()
            return response.json()
        except Exception as e:
            self.print_error(f"Failed to get realms: {e}")
            return []
    
    def create_test_realm_with_content(self) -> Optional[str]:
        """Create a test realm with sample content for demonstration."""
        self.print_step("Creating test realm with sample content...")
        
        try:
            # Create realm
            realm_data = {
                "name": "Synthesis Test Realm",
                "system_prompt": "Basic test realm for synthesis enhancement demo"
            }
            response = self.session.post(f"{self.base_url}/realms", json=realm_data)
            response.raise_for_status()
            realm = response.json()
            realm_id = realm["id"]
            
            self.print_success(f"Created test realm: {realm_id}")
            
            # Add sample content sources
            sample_content = [
                {
                    "realm_id": realm_id,
                    "source_type": "text",
                    "title": "Personal Philosophy",
                    "content": "I believe in continuous learning and helping others grow. Technology should be used to empower people, not replace human connection. I value authenticity, curiosity, and kindness in all interactions.",
                    "weight": 3.0
                },
                {
                    "realm_id": realm_id,
                    "source_type": "reflection",
                    "title": "Communication Style",
                    "content": "Q: How do you prefer to communicate complex ideas?\nA: I like to break down complex concepts into simple, relatable examples. I prefer direct but friendly communication, and I always try to acknowledge when I don't know something.",
                    "weight": 2.5
                },
                {
                    "realm_id": realm_id,
                    "source_type": "text",
                    "title": "Work Preferences",
                    "content": "I work best in collaborative environments where ideas can be shared freely. I prefer asynchronous communication for deep work, but I value regular check-ins and feedback. I believe in iterative improvement over perfectionism.",
                    "weight": 2.0
                }
            ]
            
            for content in sample_content:
                response = self.session.post(f"{self.base_url}/content-sources", json=content)
                response.raise_for_status()
            
            self.print_success("Added sample content sources")
            return realm_id
            
        except Exception as e:
            self.print_error(f"Failed to create test realm: {e}")
            return None
    
    async def run_comprehensive_test(self):
        """Run a comprehensive test of the enhanced synthesis system."""
        self.print_header("PATHFINDER SYNTHESIS ENHANCEMENT TEST SUITE")
        
        # Test 1: Migration
        self.print_header("STEP 1: DATA MIGRATION")
        migration_results = {
            "reflections": self.migrate_reflections_to_content_sources(),
            "texts": self.migrate_texts_to_content_sources()
        }
        
        # Test 2: API Testing
        self.print_header("STEP 2: API FUNCTIONALITY TEST")
        api_test_passed = self.test_content_sources_api()
        
        # Test 3: Get or create a realm for testing
        self.print_header("STEP 3: REALM PREPARATION")
        realms = self.get_available_realms()
        
        if realms:
            realm_id = realms[0]["id"]
            self.print_success(f"Using existing realm: {realms[0]['name']} ({realm_id})")
        else:
            realm_id = self.create_test_realm_with_content()
            if not realm_id:
                self.print_error("Cannot proceed without a realm")
                return
        
        # Test 4: Content Analysis
        self.print_header("STEP 4: CONTENT ANALYSIS TEST")
        analysis_results = self.test_content_analysis(realm_id)
        
        # Test 5: Advanced Synthesis
        self.print_header("STEP 5: ADVANCED SYNTHESIS TEST")
        synthesis_result = await self.test_advanced_synthesis(realm_id)
        
        # Summary
        self.print_header("TEST SUMMARY")
        
        total_migrated = (migration_results["reflections"]["migrated_count"] + 
                         migration_results["texts"]["migrated_count"])
        
        print(f"📊 Migration Results:")
        print(f"   • Reflections migrated: {migration_results['reflections']['migrated_count']}")
        print(f"   • Texts migrated: {migration_results['texts']['migrated_count']}")
        print(f"   • Total content sources created: {total_migrated}")
        
        print(f"\n🔧 API Tests:")
        print(f"   • Content Sources API: {'✅ PASSED' if api_test_passed else '❌ FAILED'}")
        print(f"   • Content Analysis: {'✅ PASSED' if analysis_results else '❌ FAILED'}")
        print(f"   • Advanced Synthesis: {'✅ PASSED' if synthesis_result else '❌ FAILED'}")
        
        if synthesis_result:
            print(f"\n🎯 Generated System Prompt Preview:")
            print(f"   {synthesis_result[:200]}...")
        
        self.print_header("NEXT STEPS")
        print("1. The enhanced synthesis system is now operational")
        print("2. Use the content sources API to manage your content")
        print("3. Run advanced synthesis to generate improved prompts")
        print("4. Monitor quality scores and iteratively improve content")
        print("5. Check the SYNTHESIS_ENHANCEMENT_PLAN.md for detailed usage instructions")

def main():
    """Main entry point for the migration and testing utility."""
    import sys
    
    tester = PathfinderMigrationTester()
    
    if len(sys.argv) > 1:
        command = sys.argv[1].lower()
        
        if command == "migrate":
            # Just run migration
            tester.print_header("MIGRATION ONLY")
            tester.migrate_reflections_to_content_sources()
            tester.migrate_texts_to_content_sources()
        
        elif command == "test-api":
            # Just test APIs
            tester.print_header("API TESTING ONLY")
            tester.test_content_sources_api()
        
        elif command == "create-demo":
            # Create demo realm
            tester.print_header("DEMO REALM CREATION")
            realm_id = tester.create_test_realm_with_content()
            if realm_id:
                print(f"Demo realm created: {realm_id}")
        
        else:
            print("Usage: python migration_and_testing.py [migrate|test-api|create-demo]")
            print("Or run without arguments for full comprehensive test")
    
    else:
        # Run comprehensive test
        asyncio.run(tester.run_comprehensive_test())

if __name__ == "__main__":
    main() 
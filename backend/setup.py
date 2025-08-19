#!/usr/bin/env python3
"""
Setup script for Agendify backend
"""

import os
import subprocess
import sys

def run_command(command, description):
    """Run a command and handle errors"""
    print(f"🔄 {description}...")
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        print(f"✅ {description} completed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed: {e}")
        print(f"Error output: {e.stderr}")
        return False

def main():
    print("🚀 Setting up Agendify Backend...")
    print("=" * 50)
    
    # Check Python version
    if sys.version_info < (3, 8):
        print("❌ Python 3.8+ is required")
        sys.exit(1)
    
    print(f"✅ Python {sys.version_info.major}.{sys.version_info.minor} detected")
    
    # Create virtual environment
    if not os.path.exists('venv'):
        print("🔄 Creating virtual environment...")
        if not run_command('python3 -m venv venv', 'Creating virtual environment'):
            sys.exit(1)
    else:
        print("✅ Virtual environment already exists")
    
    # Determine activation command based on OS
    if os.name == 'nt':  # Windows
        activate_cmd = 'venv\\Scripts\\activate'
        pip_cmd = 'venv\\Scripts\\pip'
    else:  # Unix/Linux/macOS
        activate_cmd = 'source venv/bin/activate'
        pip_cmd = 'venv/bin/pip'
    
    # Install dependencies
    print("🔄 Installing Python dependencies...")
    if not run_command(f'{pip_cmd} install -r requirements.txt', 'Installing dependencies'):
        sys.exit(1)
    
    # Create .env file if it doesn't exist
    if not os.path.exists('.env'):
        print("🔄 Creating .env file from template...")
        if os.path.exists('.env.example'):
            with open('.env.example', 'r') as example_file:
                env_content = example_file.read()
            
            with open('.env', 'w') as env_file:
                env_file.write(env_content)
            
            print("✅ .env file created from template")
            print("⚠️  Please edit .env file with your Google API credentials")
        else:
            print("❌ .env.example file not found")
            sys.exit(1)
    else:
        print("✅ .env file already exists")
    
    # Initialize database
    print("🔄 Initializing database...")
    if not run_command(f'{activate_cmd} && python init_db.py', 'Database initialization'):
        print("⚠️  Database initialization failed, but you can try manually later")
    
    print("\n" + "=" * 50)
    print("🎉 Setup completed!")
    print("\nNext steps:")
    print("1. Edit .env file with your Google API credentials")
    print("2. Run: source venv/bin/activate (or venv\\Scripts\\activate on Windows)")
    print("3. Run: python app.py")
    print("4. Open http://localhost:5000 in your browser")
    print("\nFor Google API setup:")
    print("1. Go to https://console.cloud.google.com")
    print("2. Create a new project or select existing")
    print("3. Enable Google Calendar API and Gmail API")
    print("4. Create OAuth 2.0 credentials")
    print("5. Add http://localhost:5000/auth/google/callback to authorized redirect URIs")

if __name__ == '__main__':
    main() 
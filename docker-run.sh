#!/bin/bash

docker run -d p 8000:8000 --rm -v $(pwd)/SHYNOTE.db:/app/SHYNOTE.db --name shynote --env-file .env shynote:latest 

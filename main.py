import time
import os
import uuid
import aiofiles
import base64
from fastapi import BackgroundTasks, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel


class FileSchema(BaseModel):
    name: str
    file: str


app = FastAPI()


origins = ["*"]
app.add_middleware(CORSMiddleware,
                   allow_origins=origins,
                   allow_credentials=True,
                   allow_methods=["*"],
                   allow_headers=["*"],
                   )


@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response


@app.post('/api/upload/dataset')
def get_file(background_task: BackgroundTasks,
             form_data: FileSchema):
    dir = os.path.join(f'{os.getcwd()}/dataset', form_data.name)
    if not os.path.exists(dir):
        os.mkdir(dir)
    img_base64 = str(form_data.file)
    img_base64 = img_base64.split('data:image/png;base64,')
    img_base64 = img_base64[1]
    decoded_data = base64.b64decode((img_base64))
    img_file = open(f"{dir}/{uuid.uuid4()}.png", 'wb')
    img_file.write(decoded_data)
    img_file.close()
    
    return form_data


app.mount("/", StaticFiles(directory="views"))

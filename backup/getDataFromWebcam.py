import cv2
import numpy as np

face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades +  'haarcascade_frontalface_default.xml')

cap = cv2.VideoCapture(0)

while(True):
    ret , frame = cap.read()
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    faces = face_cascade.detectMultiScale(gray)
    for(x,y,g,h) in faces :
        cv2.rectangle(frame,(x,y),(x + g, y + h),(0,225,0),2)
    cv2.imshow('DETECTING FACE',frame)
    if(cv2.waitKey(1) & 0xFF == ord('q')) :
        break
cap.release()
cv2.destroyWindow()
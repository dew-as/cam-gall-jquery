our plugin name is cam-gal
---------------------------
in the html there only have two camara icon button,and two hidden input field - (one button and one image field are combo so there will be 2 combo) for storing single image or multiple image , and the button have some attributes that are 1.data-cg-name="this will be the name of the particular image" , 2.data-cg-multiple=true or false (later based on this we will save the value to the input field as array or single value - (base64)) , 3.data-cg-frame=true or false (later based on this we do the things in the jquery) , 4.data-cg-preview=true /  or false (later based on this we will display the taken image in the jquery opening modal)
 this is the things have in the html - onclicnking the button - after clicking all the other things happen in the jqery plugin.
 
in the jquery plugin
----------------------
by clicking on the html's button will open a modal in the jquery , and we can easily get the attributes from the button to this jqury by 'this' keyword
and i will mention my needs one by one...
1.if the data-cg-name in the html the input with the name have any value ('single image base 64 or multiple image array base64') and data-cg-preview=true then there will be preview of the image/images,
2.in the modal need two option s one is camara,one is galary - if galary is clicked then choose the image from files and save it to the particular data-cg-name value input as base64,if camara is selected then open camara , and data-cg-frame=true then take the frame from the path and overlay it just like now having(for the frame name take take the value of data-cg-name+.png), all the camara ui is like now having in the plugin , and after taking the image save that data as base64 to the data-cg-name value input as base64 , and after if the input have value and the data-cg-multiple=true then add a plsus icon to add another image and append that to the input as array of base64 , also each previewed image have a close icon to remove the base64 from the input(from array of base64 , or single base64).

this is the workflow of the plugin read this carefully and analyze our current implmentation and do changes - remember that the html only contain the input and button all the other ui need implement in the jquery - the camara open view need exactly like now having to the jquery
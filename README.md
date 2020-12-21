# Picture Frame: A Long Distance Virtual Object Interaction Technique

## Ian Morrissey & Jacob Walters

### Project Description

The picture frame is a long distance interaction technique that allows the user to create a picture frame as a secondary view of the virtual world. Through this frame, a variety of interactions are available to them. 

The user can place a frame through a "framing gesture" described below, and through that frame they can select objects, translate them, and manipulate their depth. The frame can be picked up, rotated, and moved around, and the image on the frame will not change, as if it was a static camera. The frame can also be zoomed in and out, in order to make it easier to manipulate objects that are far away. 

### Instructions

The test environment involves a few scenarios in which the frame might be useful. The colored cubes can be picked up and moved around through a picture frame, and they will fall and tumble like physical objects. The target can also be moved. 

The controls involve various gestures that are intuitively refelcted in the models that represent the user's hand. This is done by detecting which buttons are being touched. There are four hand positions that are recognized (on each hand):

- No buttons touched, triggers squeezed: open hand
- Stick or buttons touched: pointing hand
- Trigger touched: thumbs up
- Trigger and stick/button touched: fist

Additionally, most gestures are "activated" by pressing the trigger button. 

#### Locomotion

Basic locomotion is enabled to move around the scene as necessary. This is only available on the right hand, through simple point and click teleportation. Make the "pointing" gesture by touching the stick or buttons on the right controller, and a laser will appear. If this intersects with the ground, pressing the trigger allows you to teleport. Moving the right stick left or right will activate a snap turn.

#### Picture frame creation

Make the "open hand" gesture with both hands, by squeezing both triggers and touching no other inputs. Then, make a "frame" with your pointer and thumb fingers as such:



### Development

To build, pull this repository down and run the following commands:

```
npm install
npm run start
```

### Credit & Used Assets

Original hand model from:

https://www.blendswap.com/blend/7894

Castle model from:

https://clara.io/view/dd0eae3a-86a5-40d2-bc60-45307297519e#

Fountain model from:

https://assetstore.unity.com/packages/3d/fountain-prop-75912

Door model from:

https://assetstore.unity.com/packages/3d/props/interior/classic-interior-door-pack-1-118744

Trophy model from:

https://assetstore.unity.com/packages/3d/props/too-many-items-trophies-127644



## License

Needed?
